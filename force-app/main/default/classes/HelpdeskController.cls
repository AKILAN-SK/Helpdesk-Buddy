public with sharing class HelpdeskController {
    private static final Set<String> CATEGORIES = new Set<String>{ 'Hardware', 'Access', 'Leave', 'Other' };
    private static final Set<String> PRIORITIES = new Set<String>{ 'High', 'Medium', 'Low' };
    public class TicketDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public String caseNumber;
        @AuraEnabled public String subject;
        @AuraEnabled public String description;
        @AuraEnabled public String status;
        @AuraEnabled public String priority;
        @AuraEnabled public String category;
        @AuraEnabled public String ownerName;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public Boolean isClosed;
    }

    @AuraEnabled(cacheable=true)
    public static List<TicketDTO> getMyTickets() {
        List<TicketDTO> result = new List<TicketDTO>();
        Contact employee = findEmployeeContact();
        if (employee == null) {
            return result;
        }
        List<Case> rows = [
            SELECT Id, CaseNumber, Subject, Description, Status, Priority, Type,
                   Owner.Name, CreatedDate, IsClosed
            FROM Case
            WHERE ContactId = :employee.Id
            WITH USER_MODE
            ORDER BY CreatedDate DESC
            LIMIT 50
        ];
        for (Case c : rows) {
            TicketDTO dto = new TicketDTO();
            dto.id = c.Id;
            dto.caseNumber = c.CaseNumber;
            dto.subject = c.Subject;
            dto.description = c.Description;
            dto.status = c.Status;
            dto.priority = c.Priority;
            dto.category = c.Type;
            dto.ownerName = c.Owner.Name;
            dto.createdDate = c.CreatedDate;
            dto.isClosed = c.IsClosed;
            result.add(dto);
        }
        return result;
    }

    @AuraEnabled
    public static String createTicket(String subject, String description, String category, String priority) {
        if (String.isBlank(subject) || String.isBlank(description)) {
            throw buildException('Subject and description are required.');
        }
        if (!CATEGORIES.contains(category)) {
            throw buildException('Choose a valid category.');
        }
        if (!PRIORITIES.contains(priority)) {
            throw buildException('Choose a valid priority.');
        }
        Contact employee = findEmployeeContact();
        if (employee == null) {
            throw buildException('No contact record matches your email address. Ask an admin to add one.');
        }
        try {
            Case ticket = new Case(
                Subject = subject.abbreviate(255),
                Description = description,
                Priority = priority,
                Type = category,
                Origin = 'Web',
                ContactId = employee.Id
            );
            insert as user ticket;
            Case saved = [SELECT CaseNumber FROM Case WHERE Id = :ticket.Id WITH USER_MODE LIMIT 1];
            return saved.CaseNumber;
        } catch (DmlException e) {
            throw buildException('Could not create the ticket: ' + e.getDmlMessage(0));
        }
    }

    private static Contact findEmployeeContact() {
        String email = UserInfo.getUserEmail();
        List<Contact> matches = [
            SELECT Id FROM Contact WHERE Email = :email WITH USER_MODE LIMIT 1
        ];
        return matches.isEmpty() ? null : matches[0];
    }

    private static AuraHandledException buildException(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        return ex;
    }
}
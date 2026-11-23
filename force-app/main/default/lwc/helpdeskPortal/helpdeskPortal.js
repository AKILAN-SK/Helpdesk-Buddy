import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMyTickets from '@salesforce/apex/HelpdeskController.getMyTickets';
import createTicket from '@salesforce/apex/HelpdeskController.createTicket';

const COLUMNS = [
    { label: 'Case', fieldName: 'caseNumber', type: 'text', initialWidth: 110 },
    { label: 'Subject', fieldName: 'subject', type: 'text', wrapText: true },
    { label: 'Status', fieldName: 'status', type: 'text', initialWidth: 110 },
    { label: 'Priority', fieldName: 'priority', type: 'text', initialWidth: 100 },
    {
        label: 'Opened',
        fieldName: 'createdDate',
        type: 'date',
        initialWidth: 120,
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' }
    },
    {
        type: 'button',
        initialWidth: 90,
        typeAttributes: { label: 'Details', name: 'view', variant: 'base' }
    }
];

const EMPTY_FORM = { subject: '', description: '', category: '', priority: 'Medium' };

export default class HelpdeskPortal extends LightningElement {
    columns = COLUMNS;
    tickets = [];
    error;
    isLoaded = false;
    isSaving = false;
    showForm = false;
    statusFilter = 'open';
    selectedId;
    form = { ...EMPTY_FORM };
    wiredResult;

    categoryOptions = [
        { label: 'Hardware', value: 'Hardware' },
        { label: 'Access', value: 'Access' },
        { label: 'Leave', value: 'Leave' },
        { label: 'Other', value: 'Other' }
    ];
    priorityOptions = [
        { label: 'High', value: 'High' },
        { label: 'Medium', value: 'Medium' },
        { label: 'Low', value: 'Low' }
    ];
    filterOptions = [
        { label: 'Open tickets', value: 'open' },
        { label: 'Closed tickets', value: 'closed' },
        { label: 'All tickets', value: 'all' }
    ];

    @wire(getMyTickets)
    wiredTickets(result) {
        this.wiredResult = result;
        const { data, error } = result;
        if (data) {
            this.tickets = data;
            this.error = undefined;
            this.isLoaded = true;
        } else if (error) {
            this.tickets = [];
            this.error = this.reduceError(error);
            this.isLoaded = true;
        }
    }

    get isLoading() {
        return !this.isLoaded;
    }

    get filteredTickets() {
        if (this.statusFilter === 'open') return this.tickets.filter((t) => !t.isClosed);
        if (this.statusFilter === 'closed') return this.tickets.filter((t) => t.isClosed);
        return this.tickets;
    }

    get hasTickets() {
        return this.filteredTickets.length > 0;
    }

    get openCount() {
        return this.tickets.filter((t) => !t.isClosed).length;
    }

    get closedCount() {
        return this.tickets.filter((t) => t.isClosed).length;
    }

    get highCount() {
        return this.tickets.filter((t) => !t.isClosed && t.priority === 'High').length;
    }

    get selectedTicket() {
        return this.tickets.find((t) => t.id === this.selectedId);
    }

    get formButtonLabel() {
        return this.showForm ? 'Close form' : 'New ticket';
    }

    toggleForm() {
        this.showForm = !this.showForm;
        if (!this.showForm) {
            this.form = { ...EMPTY_FORM };
        }
    }

    handleFieldChange(event) {
        const name = event.target.dataset.name;
        this.form = { ...this.form, [name]: event.detail.value };
    }

    handleFilterChange(event) {
        this.statusFilter = event.detail.value;
    }

    handleRowAction(event) {
        if (event.detail.action.name === 'view') {
            this.selectedId = event.detail.row.id;
        }
    }

    closeDetails() {
        this.selectedId = undefined;
    }

    async handleRefresh() {
        this.isLoaded = false;
        try {
            await refreshApex(this.wiredResult);
        } finally {
            this.isLoaded = true;
        }
    }

    async handleSubmit() {
        const allValid = [...this.template.querySelectorAll('.ticket-input')].reduce(
            (valid, input) => input.reportValidity() && valid,
            true
        );
        if (!allValid) return;

        this.isSaving = true;
        try {
            const caseNumber = await createTicket({
                subject: this.form.subject,
                description: this.form.description,
                category: this.form.category,
                priority: this.form.priority
            });
            this.toast('Ticket created', `Your ticket number is ${caseNumber}.`, 'success');
            this.form = { ...EMPTY_FORM };
            this.showForm = false;
            this.statusFilter = 'open';
            await refreshApex(this.wiredResult);
        } catch (e) {
            this.toast('Could not create ticket', this.reduceError(e), 'error');
        } finally {
            this.isSaving = false;
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    reduceError(error) {
        if (Array.isArray(error?.body)) return error.body.map((e) => e.message).join(', ');
        return error?.body?.message || error?.message || 'Something went wrong. Try again.';
    }
}
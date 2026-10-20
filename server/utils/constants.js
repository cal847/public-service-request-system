/**
 * Defines project constants for consistency across all files
 */
const CATEGORIES = ['Streetlight', 'Water', 'Garbage collection', 'Roads', 'Other'];
const STATUSES = ['Pending', 'In Progress', 'Resolved'];

// The only allowed moves. Anything else is rejected by the API.
const NEXT_STATUS = { Pending: 'In Progress', 'In Progress': 'Resolved' };

module.exports = { CATEGORIES, STATUSES, NEXT_STATUS };
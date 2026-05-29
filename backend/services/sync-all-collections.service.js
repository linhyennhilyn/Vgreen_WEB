/**
 * Backward compatibility: Re-export từ sync-collections.service.js
 * File này giữ lại để đảm bảo không break code hiện tại
 */

const {
  syncAllCollectionsToJsonAsync,
  syncAllCollectionsToJson
} = require('./sync-collections.service');

// Alias cho syncCollectionToJsonAsync (tên cũ)
const syncCollectionToJsonAsync = syncAllCollectionsToJsonAsync;

module.exports = {
  syncCollectionToJsonAsync,
  syncAllCollectionsToJsonAsync,
  syncAllCollectionsToJson
};

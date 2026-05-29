/**
 * Backward compatibility: Re-export từ sync-collections.service.js
 * File này giữ lại để đảm bảo không break code hiện tại
 */

const {
  syncUsersToJsonAsync,
  syncUsersToJson
} = require('./sync-collections.service');

module.exports = {
  syncUsersToJsonAsync,
  syncUsersToJson
};

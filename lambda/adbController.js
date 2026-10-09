const axios = require('axios');

const DEFAULT_BASE_URL = process.env.TV_REMOTE_BASE_URL || 'http://192.168.1.50:8080';

async function sendRemoteAction(action) {
  const response = await axios.post(`${DEFAULT_BASE_URL}/command`, { action }, {
    timeout: 8000,
    validateStatus: () => true,
  });

  return {
    ok: response.status >= 200 && response.status < 300,
    statusCode: response.status,
    body: response.data,
  };
}

async function getStatus() {
  const response = await axios.get(`${DEFAULT_BASE_URL}/status`, {
    timeout: 8000,
    validateStatus: () => true,
  });

  return {
    ok: response.status >= 200 && response.status < 300,
    statusCode: response.status,
    body: response.data,
  };
}

module.exports = {
  sendRemoteAction,
  getStatus,
};

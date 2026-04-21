const getUsers = async (query) => {
  return { data: [], pagination: {} };
};

const updateUserStatus = async (userId, payload) => {
  return { message: 'Not implemented' };
};

const getAnalytics = async (query) => {
  return { message: 'Not implemented' };
};

module.exports = { getUsers, updateUserStatus, getAnalytics };

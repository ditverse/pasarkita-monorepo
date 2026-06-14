const profileService = require('./profile.service');
const { updateProfileSchema, addressSchema } = require('./profile.schema');

const getProfile = async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.user.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const validData = updateProfileSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.user.id, validData);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

const getAddresses = async (req, res, next) => {
  try {
    const addresses = await profileService.getAddresses(req.user.id);
    res.json({ success: true, data: addresses });
  } catch (err) {
    next(err);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const validData = addressSchema.parse(req.body);
    const address = await profileService.addAddress(req.user.id, validData);
    res.status(201).json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
};

const updateAddress = async (req, res, next) => {
  try {
    const validData = addressSchema.parse(req.body);
    const address = await profileService.updateAddress(req.user.id, req.params.id, validData);
    res.json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    await profileService.deleteAddress(req.user.id, req.params.id);
    res.json({ success: true, message: 'Alamat berhasil dihapus' });
  } catch (err) {
    next(err);
  }
};

const setPrimaryAddress = async (req, res, next) => {
  try {
    const address = await profileService.setPrimaryAddress(req.user.id, req.params.id);
    res.json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setPrimaryAddress,
};

const complaintService = require('./complaint.service');
const { 
  createComplaintSchema, 
  replyComplaintSchema, 
  resolveComplaintSchema, 
  adminResolveComplaintSchema 
} = require('./complaint.schema');

const createComplaint = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { orderId } = req.params;
    const payload = createComplaintSchema.parse(req.body);

    const complaint = await complaintService.createComplaint(buyerId, orderId, payload);
    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    next(error);
  }
};

const getComplaints = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const filters = req.query;

    const complaints = await complaintService.getComplaints(userId, role, filters);
    res.json({ success: true, data: complaints });
  } catch (error) {
    next(error);
  }
};

const getComplaintById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { id } = req.params;

    const complaint = await complaintService.getComplaintById(id, userId, role);
    res.json({ success: true, data: complaint });
  } catch (error) {
    next(error);
  }
};

const replyComplaint = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const { id } = req.params;
    const payload = replyComplaintSchema.parse(req.body);

    const complaint = await complaintService.replyComplaint(sellerId, id, payload.reply);
    res.json({ success: true, data: complaint });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    next(error);
  }
};

const resolveComplaint = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { id } = req.params;
    const payload = resolveComplaintSchema.parse(req.body);

    const complaint = await complaintService.resolveComplaint(buyerId, id, payload.accepted);
    res.json({ success: true, data: complaint });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    next(error);
  }
};

const adminResolveComplaint = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const payload = adminResolveComplaintSchema.parse(req.body);

    const complaint = await complaintService.adminResolveComplaint(adminId, id, payload);
    res.json({ success: true, data: complaint });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    next(error);
  }
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  replyComplaint,
  resolveComplaint,
  adminResolveComplaint,
};

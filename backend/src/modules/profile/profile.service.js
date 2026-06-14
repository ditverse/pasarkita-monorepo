const supabase = require('../../config/supabase');

const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, avatar_url, role, created_at')
    .eq('id', userId)
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const updateProfile = async (userId, payload) => {
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select('id, name, email, phone, avatar_url, role')
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const getAddresses = async (userId) => {
  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data || [];
};

const addAddress = async (userId, payload) => {
  // If this is the first address or marked as primary, we need to handle primary logic
  if (payload.is_primary) {
    await supabase.from('user_addresses').update({ is_primary: false }).eq('user_id', userId);
  } else {
    // Check if user has any addresses, if not, force this to be primary
    const { count } = await supabase
      .from('user_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (count === 0) {
      payload.is_primary = true;
    }
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .insert([{ ...payload, user_id: userId }])
    .select()
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const updateAddress = async (userId, addressId, payload) => {
  if (payload.is_primary) {
    await supabase.from('user_addresses').update({ is_primary: false }).eq('user_id', userId);
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .update(payload)
    .eq('id', addressId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const deleteAddress = async (userId, addressId) => {
  const { data: address } = await supabase
    .from('user_addresses')
    .select('is_primary')
    .eq('id', addressId)
    .eq('user_id', userId)
    .single();

  const { error } = await supabase
    .from('user_addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  // If deleted address was primary, make the most recently created address primary
  if (address?.is_primary) {
    const { data: latest } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      await supabase
        .from('user_addresses')
        .update({ is_primary: true })
        .eq('id', latest.id);
    }
  }

  return true;
};

const setPrimaryAddress = async (userId, addressId) => {
  await supabase.from('user_addresses').update({ is_primary: false }).eq('user_id', userId);
  
  const { data, error } = await supabase
    .from('user_addresses')
    .update({ is_primary: true })
    .eq('id', addressId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
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

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing connection to:', supabaseUrl);
console.log('Using Key (first 10 chars):', supabaseKey ? supabaseKey.substring(0, 10) : 'MISSING');

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase Error:', error);
    } else {
      console.log('Connection successful! User count:', data);
    }
  } catch (err) {
    console.error('Fetch Failed Exception:', err);
  }
}

test();

const supabaseUrl = 'https://cvfprrtxeihcwlilxjlp.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZnBycnR4ZWloY3dsaWx4amxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg4OTQ4NiwiZXhwIjoyMDk2NDY1NDg2fQ.3wrkYLxYmF4CYCSFpgF0lCy37C7JTJ55ejhubUlQXcs';

async function inspect() {
  console.log('Fetching OpenAPI schema for assets table...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const schema = await response.json();
    const tableDef = schema.definitions.assets;
    if (tableDef) {
      console.log('assets definition:');
      console.log(JSON.stringify(tableDef, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

inspect();

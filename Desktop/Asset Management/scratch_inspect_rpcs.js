const supabaseUrl = 'https://cvfprrtxeihcwlilxjlp.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZnBycnR4ZWloY3dsaWx4amxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg4OTQ4NiwiZXhwIjoyMDk2NDY1NDg2fQ.3wrkYLxYmF4CYCSFpgF0lCy37C7JTJ55ejhubUlQXcs';

async function inspect() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const schema = await response.json();
    console.log('Paths:', Object.keys(schema.paths).filter(p => p.startsWith('/rpc/')));
  } catch (error) {
    console.error('Error:', error);
  }
}

inspect();

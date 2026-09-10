import fs from 'node:fs/promises';for(const name of await fs.readdir('schema'))if(name.endsWith('.json'))JSON.parse(await fs.readFile(`schema/${name}`,'utf8'));console.log('Schema JSON parse PASS');

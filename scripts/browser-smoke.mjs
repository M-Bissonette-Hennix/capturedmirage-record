import {spawn} from 'node:child_process';
const command=process.env.RECORD_BROWSER_COMMAND||'';
if(!command){console.error('Browser QA requires RECORD_BROWSER_COMMAND (CI sets this to the Playwright harness).');process.exit(2);}
const child=spawn(command,{shell:true,stdio:'inherit'});child.on('exit',code=>process.exit(code??1));

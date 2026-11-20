import {readFileSync,writeFileSync} from 'node:fs';
import {compareProfiles} from '../dist/compare.mjs';
const [before,after,output]=process.argv.slice(2);
if(!before||!after){console.error('Usage: node scripts/compare_profiles.mjs before.json after.json [comparison.json]');process.exit(1);}
try{
 const result=compareProfiles(JSON.parse(readFileSync(before,'utf8')),JSON.parse(readFileSync(after,'utf8')));
 const json=JSON.stringify(result,null,2)+'\n';
 if(output)writeFileSync(output,json);else process.stdout.write(json);
}catch(error){console.error(error.message);process.exitCode=1;}

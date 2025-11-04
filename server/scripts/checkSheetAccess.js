// server/scripts/checkSheetAccess.js
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';

async function main(){
  try{
    let creds = null;
    if(process.env.GOOGLE_SA_JSON){
      creds = JSON.parse(process.env.GOOGLE_SA_JSON);
      console.log('Using GOOGLE_SA_JSON from env');
    } else if(process.env.GOOGLE_CREDENTIALS_FILE && fs.existsSync(process.env.GOOGLE_CREDENTIALS_FILE)){
      creds = JSON.parse(fs.readFileSync(process.env.GOOGLE_CREDENTIALS_FILE,'utf8'));
      console.log('Using GOOGLE_CREDENTIALS_FILE', process.env.GOOGLE_CREDENTIALS_FILE);
    } else {
      throw new Error('No credentials found. Set GOOGLE_SA_JSON or GOOGLE_CREDENTIALS_FILE');
    }

    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = process.env.SHEET_ID;
    if(!spreadsheetId) throw new Error('SHEET_ID not set');

    const res = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('Spreadsheet title:', res.data.properties.title);
    console.log('Sheets:');
    res.data.sheets.forEach(s => console.log('-', s.properties.title));
    console.log('Full response ok.');
  } catch(err){
    console.error('Check failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}
main();

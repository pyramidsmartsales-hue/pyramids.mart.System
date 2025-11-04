// server/scripts/testGoogleAuth.js
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';

async function main(){
  try{
    let credentials = null;
    if(process.env.GOOGLE_SA_JSON){
      credentials = JSON.parse(process.env.GOOGLE_SA_JSON);
      console.log('Using GOOGLE_SA_JSON from env');
    } else if(process.env.GOOGLE_CREDENTIALS_FILE && fs.existsSync(process.env.GOOGLE_CREDENTIALS_FILE)){
      credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_CREDENTIALS_FILE,'utf8'));
      console.log('Using GOOGLE_CREDENTIALS_FILE', process.env.GOOGLE_CREDENTIALS_FILE);
    } else {
      throw new Error('No credentials found. Set GOOGLE_SA_JSON or GOOGLE_CREDENTIALS_FILE');
    }

    console.log('client_email:', credentials.client_email);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log('access token:', token.token || token);
    console.log('Auth test succeeded');
  } catch(err){
    console.error('Auth test failed:', err && (err.response? err.response.data: err.message) || err);
    process.exit(1);
  }
}
main();

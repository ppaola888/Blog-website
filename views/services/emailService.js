import sgMail from '@sendgrid/mail';
import env from "dotenv";
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';

env.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
//console.log(process.env.SENDGRID_API_KEY)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

  
const sendApprovalEmail = (to, postTitle, authorName, user, categories) => {
  const mailPath = path.join(__dirname, '../../views/emails/mail.ejs');

  ejs.renderFile(mailPath, { postTitle, authorName, user, categories }, (err, html) => {
    if (err) {
      console.error('Errore nel renderizzare il template EJS:', err);
      return;
    }

    const msg = {
      from: process.env.SENDGRID_EMAIL,
      to: to,
      subject: `Il tuo post "${postTitle}" è stato approvato!`,
      html: html,
    };
  
    sgMail
    .send(msg)
      .then(response => {
        console.log('Email inviata con successo:', response[0].statusCode);
      })
      .catch(error => {
        console.error('Errore nell\'invio dell\'email:', error);
      });
  });
};

export { sendApprovalEmail };
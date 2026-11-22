import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((error: unknown) => {
  console.error(error);

  const message = document.createElement('p');
  message.className = 'document__error';
  message.setAttribute('role', 'alert');
  message.textContent = 'The dashboard could not start. Please reload the page and check the browser console.';
  document.body.replaceChildren(message);
});

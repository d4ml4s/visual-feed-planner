/* Google settings. These values are PUBLIC BY DESIGN (they ship in every page load) and are
   locked in Google Cloud to http://localhost:8000 and https://d4ml4s.github.io.
   Never put a client secret here: this app doesn't use one. */
window.CONFIG = {
  googleClientId: '425960753073-0obavlt5m6mtisn9h61u7l9jv7q2amen.apps.googleusercontent.com',
  googleApiKey: 'AIzaSyB6FmTP4D2yO-YoEq0ZgtNoXCI2sPKGcBo',   // used by the Google Picker (F1)
  googleProjectNumber: '425960753073',                         // the Picker's "app id"
  libraryFolderId: '1mT4P0pcNVXYQFuCPv_3pUbr_BEu-Wxbq'         // top folder of the media library
};

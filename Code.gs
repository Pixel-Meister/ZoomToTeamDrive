exports.cloudFunction = (eventData, context, callback) => {
/*
| --------------------------------
|   Google information
| --------------------------------
*/
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const {google} = require('googleapis');
const DRIVE_FOLDER_ID = "FOLDER_ID";

/*
| --------------------------------
|   Zoom information
| --------------------------------
*/
const ACCOUNT_ID = 'ACCOUNT_ID';
const BASE64_ID_SECRET = "ENCODED_SECRET";
let zoomToken;

const serverServerAuth = new google.auth.GoogleAuth({
  keyFile : "YOUR_KEY_FILE",
  scopes: ["https://www.googleapis.com/auth/drive","https://www.googleapis.com/auth/cloud-platform"]
});

async function createFile(title, fileUrl, folderId,typeOfFile){
  let data = {
    supportsAllDrives: true,
    requestBody: {
      name: title,
      parents: [folderId]
    }
  }
  const drive = google.drive({version: 'v3', auth: serverServerAuth});

  if(typeOfFile){
    data.requestBody.mimeType = typeOfFile;
  } else {
    const mediaData = await fetch(fileUrl).then(response => response.body);
    data.media = {body: mediaData}
  }

  console.log("File created");
  return drive.files.create(data);
}

async function fetchData(url = "", fetchMethod = "POST", fetchHeaders = {}, data) {
  let response = await fetch(url, {
    method:fetchMethod,
    headers:fetchHeaders,
    redirect:"follow",
    body:JSON.stringify(data)
    });
    return response.json();
}
async function getUserData() {
  let userInfo = await fetchData(`https://api.zoom.us/v2/users`,"GET",{Authorization: "Bearer " + zoomToken},undefined);
  let userRecordings = [];
  userInfo.users.forEach(user => userRecordings.push(`https://api.zoom.us/v2/users/${user.id}/recordings`));
  console.log("Got user data");
  return userRecordings;
}
function dateMaker(i){
  let date = new Date();
  date.setDate(date.getDate() - i * 30);
  //console.log(`Made date: ${date}`);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

async function getRecordedMeetings(userRecordingUrl,monthsBack = 2) {
  let recordings = [];
  for (let i = 0; i < monthsBack; i++) {
      let from = dateMaker(i + 1);
      let to = dateMaker(i);
      let url = `${userRecordingUrl}?from=${from}&to=${to}&page_size=300`;
      const response = await fetchData(url, "GET", {Authorization: "Bearer " + zoomToken});
      if(response.total_records > 0){
          for(let meeting of response.meetings){
              const name = `${meeting.topic} | ${meeting.start_time}`;
              recordings[name] = meeting.recording_files;
          }
      }
  }
  return recordings;
}

async function main(){
  const authInfo = await fetchData(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`,"POST",{Authorization:`Basic ${BASE64_ID_SECRET}`});
  zoomToken = authInfo.access_token;
  const users = await getUserData(); //array of user urls
  for(let user of users){
    const meetingArray = await getRecordedMeetings(user,1);
    for (const [key,value] of Object.entries(meetingArray)){
      console.log(`Working on meeting: ${key} with ${value.length} files`);
      if(value.length > 0) {
        //Here's where we create the folder in Google Drive
        const folder = await createFile("Test:🐩" + key,undefined,DRIVE_FOLDER_ID,'application/vnd.google-apps.folder');
        console.log(`Created folder ${key} with id ${folder.data.id}`);
        //console.log(folder);
        
        let recordingPromises = []
        //Here's where we create the files in Google Drive
        for(var recording of value){
          recordingPromises.push(
            createFile(`${key}|${recording.recording_type}.${recording.file_type.toLowerCase()}`,`${recording.download_url}?access_token=${zoomToken}`,folder.data.id)
            );
        }
        await Promise.all(recordingPromises)/*.then(
          await fetchData(`https://api.zoom.us/v2/meetings/${value[0].meeting_id}/recordings?action=trash`,"DELETE",{Authorization: "Bearer " + token}))*/;
          
      }
    }
  }
}



  main().then(console.log("Uploading the folder 🗃️")).catch(console.error);

};

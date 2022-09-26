const scriptProperties = PropertiesService.getScriptProperties();
function privateInfo() {
  scriptProperties.setProperties({
    'ACCOUNT_ID' : "", //Your Zoom Account ID
    'BASE64_ID_SECRET' : "", //Your Base-64 encoded ID and Secret from a Server to Server Zoom app
    'DRIVE_FOLDER_ID' : "" // ID of the folder you want the recordings to go into
  });
}
let token;

async function fetchData(url = "", fetchMethod = "POST", fetchHeaders = {}, data = {}) {
  const response = await UrlFetchApp.fetch(url, {
    method:fetchMethod,
    headers:fetchHeaders,
    redirect:"follow",
    body:JSON.stringify(data)
    });
  if(response.getContentText() != null && response.getResponseCode() == 200) {
    return JSON.parse(response.getContentText()); // parses JSON response into native JavaScript objects
  }
  else {
    return response.getResponseCode() == 200;
  }
}
async function getUserData() {
  let userInfo = await fetchData(`https://api.zoom.us/v2/users`,"GET",{Authorization: "Bearer " + token});
  let userRecordings = [];
  userInfo.users.forEach(user => userRecordings.push(`https://api.zoom.us/v2/users/${user.id}/recordings`));
  return userRecordings;
}
function dateMaker(i){
  let date = new Date();
  date.setDate(date.getDate() - i * 30);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
async function getRecordedMeetings(userRecordingUrl,monthsBack = 2) {
  let recordings = [];
  for (let i = 0; i < monthsBack; i++) {
      let from = dateMaker(i + 1);
      let to = dateMaker(i);
      let url = `${userRecordingUrl}?from=${from}&to=${to}&page_size=300`;
      const response = await fetchData(url, "GET", {Authorization: "Bearer " + token});
      if(response.total_records > 0){
          for(let meeting of response.meetings){
              const name = `${meeting.topic} | ${meeting.start_time}`;
              recordings[name] = meeting.recording_files;
          }
      }
  }
  return recordings;
}
async function toGoogleDrive(name,fileUrl,folderId){
  console.log(`${name}, ${fileUrl}, ${folderId}`)
  let resource = {
    supportsAllDrives : true
  }
  let mediaData = UrlFetchApp.fetch(fileUrl).getBlob();
  let schema = {
    title : name,
    parents: [{id: folderId}],
    uploadType: "resumable"
  }
  Drive.Files.insert(schema,mediaData,resource);
}

async function test(){
  const authInfo = await fetchData(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${scriptProperties.getProperty("ACCOUNT_ID")}`,"POST",{Authorization:`Basic ${scriptProperties.getProperty("BASE64_ID_SECRET")}`});
  token = authInfo.access_token;
  const users = await getUserData(); //array of user urls
  for(let user of users){
    const meetingArray = await getRecordedMeetings(user,64);
    for (const [key,value] of Object.entries(meetingArray)){
      //console.log(key);
      //console.log(value);
      if(value.length > 0) {
        const folder = await Drive.Files.insert({title : key,parents: [{id: scriptProperties.getProperty("DRIVE_FOLDER_ID")}],uploadType: "resumable",mimeType: 'application/vnd.google-apps.folder'},null,{supportsAllDrives : true});
        let recordingPromises = []
        for(recording of value){
          recordingPromises.push(toGoogleDrive(`${key}|${recording.recording_type}.${recording.file_type.toLowerCase()}`,`${recording.download_url}?access_token=${token}`,folder.id));
        }
        await Promise.all(recordingPromises).then(
          await fetchData(`https://api.zoom.us/v2/meetings/${value[0].meeting_id}/recordings?action=trash`,"DELETE",{Authorization: "Bearer " + token}));
      }
    }
  }   
}

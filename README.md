# ZoomToTeamDrive
This is an AppsScript program that moves Zoom  cloud recordings to a folder in a Google individual or shared drive. After moving the recordings to the drive, it trashes the cloud recording in Zoom. You can access trashed files for several days in case you need a recording back.

This script used the PropertiesService to store credentials. Fill out the info in the privateInfo function, then run that function once. You can then remove that info from the script. Afterward, run the main function specifying how many months back you want to go.

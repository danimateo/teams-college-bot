# What is this?

A bot running a headless chrome instance using Puppeteer to join Microsoft Teams classes automatically

# What can it do?

As of now, it can play sounds (like say 'Here', or 'Attending', or anything you want really), loop through your visible meetings and join them, leave the meeting when it's done, toggle mute/unmute. It also has an override, if you write 'pause' it stops it from looping and you can take control (that is if it's not running in headless ofc)

# How can I run it?

Well, there are a few steps.

1. First of all, we need to setup the virtual microphone for playing sounds. Run the bash script `scripts/virtual_mic`, it should take care of everything (and keep it running for as long as you want to use this, it unloads the virtual mic automatically when it's closed). Also, you need to place an MP3 file in the `sounds` directory, called `attending.mp3`, which is you recorded saying whatever you want for attendance list checks.
2. Move `config.example.js` to `config.js` and place in your details for username, password and whatever else you want. `showBrowser` means if it should run headless or not
3. Run it with `npm run start` or `node index.js`

# Is it ready for use

Not really, a few things need to be ironed out, it should be soon though
const puppeteer = require('puppeteer')
const readline = require('readline')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { username, password, showBrowser } = require('./config')
const selectors = require('./selectors')
const path = require('path')

let IS_LOOPING = true

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const MIC_ACTIONS = {
  MUTE: 0,
  UNMUTE: 1,
}

const getNumberOfParticipants = (page) =>
  page.evaluate(() =>
    document.querySelectorAll(selectors.meetingNrOfParticipants)[1].innerText.replace(/[\(\)]/g, '')
  )

const getSpeakingParticipantsNames = (page) =>
  page.evaluate((speakingAvatarSelector) => {
    const speakingAvatars = [...document.querySelectorAll(speakingAvatarSelector)]
    return speakingAvatars.map((el) => el.parentElement.querySelector(selectors.userNameSpan).title)
  }, selectors.speakingAvatar)

const leaveMeeting = (page) => page.evaluate(() => document.querySelector(selectors.hangupButton).click())

const setMicrophoneStatus = (page, action) =>
  page.evaluate(
    (action, MIC_ACTIONS, micButtonSelector) => {
      const micButton = document.querySelector(micButtonSelector)
      const isMuted = micButton.ariaLabel === 'Unmute'
      if (action === MIC_ACTIONS.MUTE) if (!isMuted) micButton.click()
      if (action === MIC_ACTIONS.UNMUTE) if (isMuted) micButton.click()
    },
    action,
    MIC_ACTIONS,
    selectors.microphoneButton
  )

const playSound = async (page, mp3Name) => {
  await setMicrophoneStatus(page, MIC_ACTIONS.UNMUTE)
  await timeout(200)
  const playScriptPath = path.join(__dirname, 'scripts', 'play_audio')
  const attendingPath = path.join(__dirname, 'sounds', mp3Name)
  await exec(`${playScriptPath} ${attendingPath}`)
  await timeout(4000)
  await setMicrophoneStatus(page, MIC_ACTIONS.MUTE)
}

const getInput = () =>
  new Promise((resolve) => {
    rl.question('Type pause to pause looping, play to run: ', (input) =>
      resolve(input === 'play' ? true : false)
    )
  })

const waitForLooping = () =>
  new Promise((resolve) => {
    const interval = setInterval(() => {
      if (IS_LOOPING) {
        clearInterval(interval)
        return resolve()
      }
    }, 1000)
  })

const timeout = (time) => new Promise((resolve) => setTimeout(resolve, time))

const loginToTeams = async (page) => {
  await page.goto('https://teams.microsoft.com', { waitUntil: 'networkidle0' })
  await page.type(selectors.usernameField, username)
  await page.click(selectors.loginNext)
  await page.type(selectors.passwordField, password)
  await timeout(2000)
  await page.click(selectors.loginNext)
  await timeout(2000)
  await page.click(selectors.loginNext)
  await page.waitForNavigation({ waitUntil: 'networkidle0' })
}

const getTeams = (page) =>
  page.evaluate(
    (selectors) =>
      [
        ...document.querySelector(selectors.visibleTeams).querySelectorAll(selectors.teamCardContainer),
      ].filter((el) => el.innerText),
    selectors
  )

const meetingLoop = async (page) => {
  await page.evaluate(async (selectors) => {
    await timeout(1000)
    document.querySelector(selectors.inputToggleButton).click()
    await timeout(500)
    document.querySelector(selectors.prejoinSettings).click()
    await timeout(500)

    document.querySelectorAll(selectors.dropdownPreJoin)[2].click()
    await timeout(500)
    ;[...document.querySelectorAll(selectors.dropdownItems)]
      .find((el) => el.innerText.includes('FIFO'))
      .click()
    await timeout(500)

    document.querySelector(selectors.closePreJoinSettings).click()
    await timeout(500)

    document.querySelector(selectors.joinMeetingButton).click()
  }, selectors)
  await timeout(5000)
  await playSound(page, 'attending.mp3')
  await timeout(1e8)
}

const checkIfMeetingOngoingAndJoin = (page) =>
  page.evaluate((selectors) => {
    const joinButton = document.querySelector(selectors.prejoinButton)
    if (joinButton) joinButton.click()
    return !!joinButton
  }, selectors)

const loopThroughTeams = async (page) => {
  const teams = await getTeams(page)

  for (let i = 0; i < teams.length; i++) {
    if (!IS_LOOPING) await waitForLooping()

    await page.evaluate(
      (idx, selectors) => {
        const el = [...document.querySelectorAll(selectors.teamCard)][idx]
        console.log(el)
        return el.click()
      },
      i,
      selectors
    )

    await timeout(4000)
    if (await checkIfMeetingOngoingAndJoin(page)) await meetingLoop(page)
    await page.click(selectors.goBackButton)
    await timeout(1000)
  }
}

const checkForInputLoop = () => {
  getInput()
    .then((val) => {
      IS_LOOPING = val
    })
    .then(checkForInputLoop)
}

;(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: !showBrowser,
      args: ['--disable-features=site-per-process', '--no-sandbox', '--use-fake-ui-for-media-stream'],
    })
    const page = await browser.newPage()

    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    })

    await page.exposeFunction('timeout', timeout)

    checkForInputLoop()

    await loginToTeams(page)
    await timeout(10 * 1000)

    while (true) await loopThroughTeams(page)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
})()

rl.on('close', () => process.exit(0))

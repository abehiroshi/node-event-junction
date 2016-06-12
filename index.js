import chokidar from 'chokidar'
import rest from 'restler'

const url = process.env.SEND_URL
function sendEvent(event){
  if (url) {
    rest.postJson(url, event)
    .on('error', (err, res)=>{
      console.log('error')
      console.dir(res)
      console.dir(err);
    })
  } else {
    console.dir(event)
  }
}

function startWatch(pattern){
  chokidar.watch(pattern, {ignored: /[\/\\]\./, persistent: true})
    .on('error', err=>{
      sendEvent({
        name: 'watchFile',
        status: 'error',
        result: {error: err},
      })
    })
    .on('all', (event, path)=>{
      sendEvent({
        name: 'watchFile',
        status: event,
        result: {path: path},
      })
    })
}

const pattern = process.env.WATCH_PATTERN
if (pattern){
  startWatch(pattern)
} else {
  console.error('環境変数 WATCH_PATTERN が設定されていません')
}
import fs from 'fs'
import path from 'path'
import Nightmare from 'nightmare'
import Queue, {QueueConsumer} from 'blocking-queue'

const queue = new Queue()
const auth_info = {email: '', password: ''}

new QueueConsumer(queue).start(({event, args, dispatch})=>{
  console.log(`dispatch: amazon order`)
  fs.unlink(event.result.path)
  const asin = event.result.base
  Nightmare({ show: false })
    .viewport(1200, 800)
    .goto(`https://www.amazon.co.jp/gp/product/${asin}/`)
    .wait('#add-to-cart-button').wait(3000)
    .click('#add-to-cart-button')
    .wait('#hlb-ptc-btn-native').wait(3000)
    .click('#hlb-ptc-btn-native')
    .wait("form[name='signIn'] input#signInSubmit").wait(3000)
    .type("input[name='email']", auth_info.email)
    .type("input[name='password']", auth_info.password)
    .click("form[name='signIn'] input#signInSubmit")
    .wait("input[name='placeYourOrder1']").wait(3000)
    .screenshot(path.join(args.result_path, asin + '_before.png'))
    .click("input[name='placeYourOrder1']")
    .wait(5000)
    .screenshot(path.join(args.result_path, asin + '_after.png'))
    .end()
    .then(()=>{
      console.log(`Amazon order completed. [${asin}]`)
      dispatch({method: 'app', name: event.name, status: "complete", result: {asin}})
    })
    .catch(err=>{
      console.error(`Amazon order failed. [${asin}]:`, err)
      dispatch({method: 'app', name: event.name, status: "error", result: {asin, err, from: event.result}})
    })
}, 1)

export default {
  auth: (email, password)=>{
    auth_info.email = email
    auth_info.password = password
  },
  order: request => queue.push(request)
}

import path from 'path'
import Nightmare from 'nightmare'
import Queue, {QueueConsumer} from 'blocking-queue'

const queue = new Queue()
const auth_info = {email: '', password: ''}

new QueueConsumer(queue).start(({event, args, dispatch})=>{
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
    .screenshot(path.join(args.result_path, asin))
    .end()
    .then(()=>{
      console.log(`Amazon order completed. [${asin}]`)
      dispatch({name: event.name, "complete", result: {asin})
    })
    .catch(err=>{
      console.error(`Amazon order failed. [${asin}]:`, err)
      dispatch({name: event.name, "error", result: {asin, err, from: event.result}})
    })
}, 1)

export default {
  auth: (email, password)=>{
    auth_info.email = email
    auth_info.password = password
  },
  order: request => queue.push(request)
}

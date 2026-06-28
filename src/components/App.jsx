import Layout from './Layout'
import Header from './Header'
import Footer from './Footer'
import { sentryIds, gaIds } from '../constants'

const App = (props) => {
  const { env, country, timezone, v } = props
  const sentryId = sentryIds[env]
  const gaId = gaIds[env]
  return (
    <Layout sentryId={sentryId} gaId={gaId} v={v}>
      <div class="content playing">
        <div class="ambient" aria-hidden="true" />
        <Header v={v} />
        <Footer v={v} />
      </div>
      <span id="clock-data" data-country={country} data-timezone={timezone} />
    </Layout>
  )
}

export default App

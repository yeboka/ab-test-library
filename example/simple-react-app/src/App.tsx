import './App.css'
import UserWidget from './components/UserWidget'
import VariantPreview from './components/VariantPreview'

const App: React.FC = () => {
  return (
    <div className='min-h-screen bg-gray-100 '>
      <div className='max-w-[1280px] mx-auto p-4 flex gap-3 flex-col items-center md:items-start md:flex-row'>
        <UserWidget />
        <VariantPreview />
      </div>
    </div>
  )
}

export default App

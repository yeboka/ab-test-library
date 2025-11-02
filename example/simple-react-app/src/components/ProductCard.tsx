import { useExperiment } from '../hooks/useExperiment'
import { ProductCardSkeleton } from './ProductCardSkeleton'
import { Button } from './ui/button'

interface ProductCardProps {
  title: string
  imageUrl: string
  price: string | number
  onAddToCart?: () => void
  onBuy?: () => void
}

const buyButtonTexts = {
  A: 'Buy text A',
  B: 'Buy text B',
  C: 'Buy text C'
}

export const ProductCard = ({ title, imageUrl, price, onAddToCart, onBuy }: ProductCardProps) => {
  const { variant, loading } = useExperiment('product-card-variant')

  if (loading) {
    return <ProductCardSkeleton />
  }

  const buyText = buyButtonTexts[variant as keyof typeof buyButtonTexts] || 'Buy'
  const displayPrice = typeof price === 'number' ? `$${price.toFixed(2)}` : price

  return (
    <div className='max-w-sm w-full rounded-lg overflow-hidden shadow-lg bg-white transition-transform flex flex-col'>
      <div className='w-full h-48 overflow-hidden bg-gray-100'>
        <img
          src={imageUrl || 'https://via.placeholder.com/400x300?text=Product'}
          alt={title}
          className='w-full h-full object-cover'
        />
      </div>

      <div className='px-6 py-4 flex-1 flex flex-col'>
        <h3 className='font-bold text-xl mb-2 text-gray-800'>{title}</h3>
        <div className='mb-4'>
          <span className='text-2xl font-semibold text-gray-900'>{displayPrice}</span>
        </div>
        <div className='flex gap-3 mt-auto mb-4'>
          <Button variant='outline' className='flex-1' onClick={onAddToCart}>
            Add to Cart
          </Button>
          <Button variant='default' className='flex-1' onClick={onBuy}>
            {buyText}
          </Button>
        </div>
        <div className='mt-auto pt-2 border-t border-gray-200'>
          <p className='text-xs text-gray-500 text-center'>variant {variant}</p>
        </div>
      </div>
    </div>
  )
}

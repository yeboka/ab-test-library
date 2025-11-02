import { ProductCard } from './ProductCard'

const VariantPreview = () => {
  return (
    <div className='w-full border border-gray-200 rounded-lg p-4 gap-3'>
      <h1 className='text-lg font-bold mb-4'>Variant Previews</h1>
      <div className='flex flex-col gap-4'>
        <h3 className='text-sm font-medium'>Product Card example:</h3>
        <div className='w-full flex justify-center'>
          <ProductCard
            title='Product 1'
            imageUrl='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop'
            price={29.99}
            onAddToCart={() => console.log('Add to cart clicked')}
            onBuy={() => console.log('Buy clicked')}
          />
        </div>
      </div>
    </div>
  )
}

export default VariantPreview

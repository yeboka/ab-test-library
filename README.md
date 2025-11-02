# AB Testing Library

A lightweight, production-ready library for managing A/B tests with deterministic variant assignment, real-time experiment updates, and remote configuration support.

## Features

- **Deterministic Assignment**: Consistent variant assignment based on user ID and experiment key
- **Real-time Updates**: Automatically detects and handles new experiments via Supabase realtime subscriptions
- **Local Caching**: Efficient localStorage caching with automatic sync to remote storage
- **TypeScript Support**: Full TypeScript definitions included
- **Framework Agnostic**: Works with any JavaScript/TypeScript project
- **Custom Adapters**: Pluggable adapter system for any backend storage

## Installation

```bash
npm install ab-testing-library @supabase/supabase-js
```

## Setup

### 1. Database Schema

Your database needs the following tables:

**users**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT
);
```

**experiments**

```sql
CREATE TABLE experiments (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  splits JSONB NOT NULL, -- e.g., {"A": 0.5, "B": 0.5}
  enabled BOOLEAN DEFAULT true
);
```

**user_variants**

```sql
CREATE TABLE user_variants (
  user_id TEXT NOT NULL,
  experiment_key TEXT NOT NULL,
  variant TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, experiment_key)
);
```

Enable realtime on the `experiments` table in Supabase.

### 2. Initialize the Library

```typescript
import { initializeLibrary, createSupabaseAdapter } from 'ab-testing-library'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const cleanup = await initializeLibrary({
  adapter: createSupabaseAdapter(supabase),
  hashing: {
    salt: 'your-app-salt', // Optional: for deterministic hashing
    version: 1 // Optional: hash version for migration
  }
})

// Cleanup when done
cleanup()
```

## API Reference

### `initializeLibrary(options)`

Initializes the library with a storage adapter and optional hashing configuration.

**Parameters:**

- `options.adapter`: A storage adapter implementing `IRemoteStorageAdapter`
- `options.hashing.salt`: Optional salt for variant assignment hashing
- `options.hashing.version`: Optional hash version number

**Returns:** A cleanup function to unsubscribe from realtime updates

### `initializeUser(userData)`

Initializes a user and assigns variants for all enabled experiments.

```typescript
await initializeUser({
  id: 'user-123',
  email: 'user@example.com'
})
```

### `getVariant(experimentKey)`

Retrieves the variant assigned to the current user for a specific experiment.

```typescript
const variant = await getVariant('button-color-experiment')
// Returns: 'A', 'B', 'control', etc.
```

**Returns:** `string | null` - The variant name or `null` if not assigned

### `updateUser(userData, options?)`

Updates user information and optionally reassigns all variants.

```typescript
await updateUser(
  { id: 'user-123', email: 'newemail@example.com' },
  { reassignVariant: true } // Optional: reassign all variants
)
```

## Usage Examples

### React Hook Example

```typescript
import { useState, useEffect } from 'react'
import { getVariant } from 'ab-testing-library'

export const useExperiment = (experimentKey: string) => {
  const [variant, setVariant] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVariant = async () => {
      try {
        const v = await getVariant(experimentKey)
        setVariant(v)
      } catch (err) {
        console.error('Failed to get variant:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchVariant()
  }, [experimentKey])

  return { variant, loading }
}

// Usage
const { variant, loading } = useExperiment('button-color')
if (variant === 'red') {
  // Show red button
}
```

### Basic Usage

```typescript
import { initializeLibrary, initializeUser, getVariant, createSupabaseAdapter } from 'ab-testing-library'
import { createClient } from '@supabase/supabase-js'

// Initialize
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
await initializeLibrary({
  adapter: createSupabaseAdapter(supabase)
})

// Initialize user
await initializeUser({
  id: 'user-123',
  email: 'user@example.com'
})

// Get variant
const variant = await getVariant('pricing-page')
if (variant === 'A') {
  // Show variant A
}
```

### Custom Adapter

```typescript
import { IRemoteStorageAdapter } from 'ab-testing-library'

const myAdapter: IRemoteStorageAdapter = {
  async getUser(userId: string) {
    // Your implementation
  },
  async saveUser(user) {
    // Your implementation
  },
  async getExperiments() {
    // Your implementation
  },
  async getVariants(userId: string) {
    // Your implementation
  },
  async saveVariant(userId, experimentKey, variant) {
    // Your implementation
  },
  async getVariant(userId, experimentKey) {
    // Your implementation
  },
  subscribeExperiments(onChange) {
    // Optional: realtime subscription
    return () => {} // cleanup function
  }
}

await initializeLibrary({ adapter: myAdapter })
```

### Full Example: React App

A complete working example is available in the `example/simple-react-app` directory. This React application demonstrates:

- Library initialization with Supabase adapter
- React Context Provider setup for global state management
- Custom `useExperiment` hook for variant retrieval
- Real-time experiment updates
- User initialization workflow
- Component-level variant usage

**Running the Example:**

```bash
cd example/simple-react-app
npm install
npm run dev
```

**Key Files to Review:**

1. **`src/contexts/ExperimentContext.tsx`** - Library initialization and user setup
2. **`src/hooks/useExperiment.ts`** - Custom hook for fetching variants
3. **`src/components/ProductCard.tsx`** - Example component using variants
4. **`src/components/UserWidget.tsx`** - User initialization UI
5. **`src/api/supabaseApi.ts`** - Supabase client setup

**Environment Variables:**

Create a `.env` file in `example/simple-react-app/`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AB_SALT=your-app-salt
```

The example app shows:

- How to initialize the library in a React app
- How to create a context provider for experiment management
- How to use variants in React components
- How to handle loading states and errors
- Real-time experiment update detection

## Simulating Remote Config Updates

### Method 1: Direct Database Update (Supabase)

1. **Update experiment splits:**

```sql
UPDATE experiments
SET splits = '{"A": 0.3, "B": 0.7}'::jsonb
WHERE key = 'button-color-experiment';
```

2. **Create a new experiment:**

```sql
INSERT INTO experiments (key, name, splits, enabled)
VALUES ('new-experiment', 'New Feature Test', '{"A": 0.5, "B": 0.5}'::jsonb, true);
```

3. **Enable/disable an experiment:**

```sql
UPDATE experiments
SET enabled = false
WHERE key = 'old-experiment';
```

The library will automatically detect these changes via Supabase realtime subscriptions and:

- Assign variants for new experiments
- Update local cache
- Trigger reassignment if experiment splits change

### Method 2: Using Supabase Dashboard

1. Navigate to **Table Editor** → `experiments`
2. Insert/Update experiment rows
3. Changes are automatically pushed to connected clients via realtime

### Method 3: Programmatic Updates

```typescript
// Using Supabase client
const { error } = await supabase
  .from('experiments')
  .update({ splits: { A: 0.3, B: 0.7 } })
  .eq('key', 'button-color-experiment')

// New users will be assigned based on new splits
// Existing users keep their assigned variants unless reassigned
```

### Testing Variant Assignment

To test different variants for the same user, you can:

1. **Temporarily modify user ID** (for testing only):

```typescript
await initializeUser({
  id: 'user-123-test', // Different ID = different variant
  email: 'test@example.com'
})
```

2. **Force reassignment:**

```typescript
await updateUser({ id: 'user-123', email: 'user@example.com' }, { reassignVariant: true })
```

3. **Check assigned variants in database:**

```sql
SELECT * FROM user_variants WHERE user_id = 'user-123';
```

## How It Works

1. **Initialization**: Library connects to your storage backend (e.g., Supabase)
2. **User Setup**: When a user is initialized, the library assigns variants for all enabled experiments using deterministic hashing
3. **Caching**: Variants are cached locally in `localStorage` for fast access
4. **Real-time Sync**: Library listens for experiment changes and automatically assigns variants for new experiments
5. **Variant Retrieval**: `getVariant()` fetches from cache first, then remote storage if needed

## Error Handling

The library exports specific error classes:

```typescript
import {
  InitializationError,
  StorageCorruptionError,
  ExperimentNotFoundError,
  AdapterNotInitializedError
} from 'ab-testing-library'

try {
  const variant = await getVariant('experiment-key')
} catch (error) {
  if (error instanceof InitializationError) {
    // User not initialized
  } else if (error instanceof ExperimentNotFoundError) {
    // Experiment doesn't exist
  }
}
```

## License

MIT

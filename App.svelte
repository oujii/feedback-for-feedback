<script>
  import Feed from './components/Feed.svelte';
  import AddFeedItem from './components/AddFeedItem.svelte';

  let db = firebase.firestore();
</script>

<main class="flex flex-col h-full overflow-hidden">
  <section class="h-32 p-10">
    <h1>feedback for feedback</h1>
    <AddFeedItem {db} />
  </section>
  <Feed {db} />
</main>

<style global lang="postcss">
  /* only apply purgecss on utilities, per Tailwind docs */
  /* purgecss start ignore */
  @tailwind base;
  @tailwind components;
  /* purgecss end ignore */

  @tailwind utilities;

  @layer base {
    body {
      @apply h-screen;
      @apply overflow-hidden;
      font-family: 'Inter', sans-serif;
    }

    h1,
    h2,
    h3 {
      @apply font-extrabold;
    }

    h1 {
      @apply text-3xl;
    }

    h2 {
      @apply text-3xl;
    }

    h3 {
      @apply text-xl;
    }

    input:first-child {
      margin-top: 0.5rem;
    }
  }
</style>

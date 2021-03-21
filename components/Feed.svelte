<script>
  import FeedItem from './FeedItem.svelte';
  export let db;
  let items;

  $: {
    if (db) {
      db.collection('feedback').onSnapshot((querySnapshot) => {
        const feedback = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log('feedback', feedback);
        items = feedback;
      });
    }
  }
</script>

{#if items}
  <ul
    class="w-full flex-1 flex flex-col items-center list-none gap-4 p-10 bg-gray-100 overflow-auto"
  >
    {#each items as item}
      <FeedItem {item} {db} />
    {/each}
  </ul>
{/if}

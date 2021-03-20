<script>
  import FeedbackItem from './FeedbackItem.svelte';

  let items;

  userbase.openDatabase({
    databaseName: 'private-feedback',
    changeHandler: (itemsFromApi) => (items = itemsFromApi),
  });

  $: {
    console.log(items);
  }
</script>

<h1>Feedback list</h1>
{#if items}
  {#each items as item}
    <ul>
      <FeedbackItem {item} />
    </ul>
  {/each}
{/if}

<style>
  ul {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>

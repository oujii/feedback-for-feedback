<script>
  import FeedbackItem from './FeedbackItem.svelte';

  let items;

  userbase.openDatabase({
    databaseName: 'public-feedback',
    changeHandler: (itemsFromApi) => (items = itemsFromApi),
  });

  $: {
    console.log(items);
  }
</script>

<h1>To-Do List</h1>
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

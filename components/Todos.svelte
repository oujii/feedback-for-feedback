<script>
  import TodoItem from "./TodoItem.svelte";

  let items;
  let transformedItems;
  userbase.openDatabase({
    databaseName: "todos",
    changeHandler: itemsFromApi => (items = itemsFromApi)
  });

  $: {
    console.log(items);
  }
</script>

<div id="todo-view">
	<div id="username"></div>

	<h1>To-Do List</h1>
	<div id="todos"></div>
  {#if items}
     	{#each items as item}
  <ul>
		<TodoItem {item} />
</ul>
	{/each}
{/if}
</div>
<script>
  let error = "";
  let todo = "";

  function addTodoHandler(e) {
    e.preventDefault();

    userbase
      .insertItem({ databaseName: "todos", item: { todo: todo } })
      .then(() => {
        alert("Fan vad gött, du la till en Todo!");
        todo = "";
      })
      .catch(errorFromApi => (error = errorFromApi));
  }
</script>

<form on:submit={addTodoHandler}>
    <input type="text" required placeholder="To-Do" bind:value={todo} >
    <input type="submit" value="Add">
</form>
{#if error !== ''}
<div>{error}</div>
{/if}
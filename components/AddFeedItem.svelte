<script>
  let error = '';
  let headline = '';
  let description = '';
  let isExpanded = false;
  export let db;

  function addFeedbackHandler(e) {
    e.preventDefault();
    if (!db) return;

    db.collection('feedback')
      .add({
        headline,
        description,
      })
      .then((docRef) => {
        console.log('Document written with ID: ', docRef.id);
        error = '';
        headline = '';
        description = '';
      })
      .catch((error) => {
        console.error('Error adding document: ', error);
        error = error;
      });
  }
</script>

<aside
  class="max-w-sm absolute right-10 top-10 bg-white"
  class:shadow={isExpanded}
  class:p-2={isExpanded}
>
  <div
    class="flex items-center cursor-pointer mb-4"
    role="button"
    aria-expanded={isExpanded}
    on:click={() => (isExpanded = !isExpanded)}
  >
    <h3 class="mr-2">Add item</h3>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -256 1792 1792"
      width="20px"
      class="transform ease-out duration-200 text-green-500"
      class:rotate-180={isExpanded}
      ><path
        fill="currentColor"
        d="M1679.339 301.56q0 53-37 90l-651 651q-38 38-91 38-54 0-90-38l-651-651q-38-36-38-90 0-53 38-91l74-75q39-37 91-37 53 0 90 37l486 486 486-486q37-37 90-37 52 0 91 37l75 75q37 39 37 91z"
      /></svg
    >
  </div>
  {#if isExpanded}
    <form on:submit={addFeedbackHandler} class="flex flex-col">
      <label class="flex-1 mb-2">
        Headline
        <input
          type="text"
          required
          bind:value={headline}
          class="block w-full p-2 border border-gray rounded-md"
        />
      </label>
      <label class="flex-1 mb-4">
        Description
        <input
          type="text"
          required
          bind:value={description}
          class="block w-full p-2 border border-gray rounded-md"
        />
      </label>
      <button
        type="submit"
        class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-8 rounded"
        disabled={!headline && !description}
      >
        Add
      </button>
      {#if error}
        <p class="text-red-500">{error}</p>
      {/if}
    </form>
  {/if}
</aside>

<script>
  export let item;
  let isExpanded = false;
  let feedbackText = '';

  function addFeedbackHandler(e) {
    e.preventDefault();
    if (!db) return;

    db.collection('feedback')
      .add({
        text: feedbackText,
      })
      .then((docRef) => {
        console.log('Document written with ID: ', docRef.id);
      })
      .catch((error) => {
        console.error('Error adding document: ', error);
      });
  }
</script>

<li
  class="w-full flex flex-col p-4 bg-white shadow cursor-pointer hover:border hover:border-black rounded-lg"
  role="button"
  aria-expanded={isExpanded}
  on:click={() => (isExpanded = !isExpanded)}
>
  <div class="flex items-center cursor-pointer" class:mb-4={isExpanded}>
    <h3 class="mr-2">{item.headline}</h3>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -256 1792 1792"
      width="20px"
      class="transform ease-out duration-200"
      class:rotate-180={isExpanded}
      ><path
        fill="currentColor"
        d="M1679.339 301.56q0 53-37 90l-651 651q-38 38-91 38-54 0-90-38l-651-651q-38-36-38-90 0-53 38-91l74-75q39-37 91-37 53 0 90 37l486 486 486-486q37-37 90-37 52 0 91 37l75 75q37 39 37 91z"
      /></svg
    >
  </div>
  {#if isExpanded}
    <p>{item.description}</p>
    <form
      on:submit={addFeedbackHandler}
      class="flex pt-2 mt-2 border-t border-black"
    >
      <label class="flex-1">
        Headline
        <input
          type="text"
          required
          placeholder="Add feedback"
          bind:value={feedbackText}
          class="block w-full p-2 border border-gray rounded-md"
        />
      </label>
      <button
        type="submit"
        class="flex-initial bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-8 border border-blue-700 rounded"
      >
        Add
      </button>
    </form>
  {/if}
</li>

<script>
  export let id;
  export let db;
  let feedbackText = '';
  let error = '';

  function addFeedbackHandler(e) {
    e.preventDefault();
    if (!db || !id) return;

    db.collection('feedback')
      .doc(id)
      .update({
        feedback: firebase.firestore.FieldValue.arrayUnion(feedbackText),
      })
      .then((docRef) => {
        feedbackText = '';
        error = '';
        console.log(`Feedback added to ${id}`);
      })
      .catch((errorFromApi) => {
        console.error('Error adding document: ', errorFromApi);
        error = errorFromApi;
      });
  }
</script>

<form
  on:submit={addFeedbackHandler}
  on:click={(event) => event.stopPropagation()}
>
  <label class="mb-2 font-medium">
    Give feedback
    <input
      type="text"
      required
      bind:value={feedbackText}
      class="block w-full mb-4 p-2 border border-gray rounded-md"
    />
  </label>
  <button
    type="submit"
    class="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-8 rounded"
  >
    Add
  </button>
</form>

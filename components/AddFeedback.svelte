<script>
  let error = '';
  let feedback = '';
  let isPublic = true;

  function addFeedbackHandler(e) {
    e.preventDefault();

    if (isPublic == true) {
      userbase
        .shareDatabase({
          databaseName: 'public-feedback',
        })
        .then(({ shareToken }) => {
          // Any other user can now open the database using this share token
          console.log(shareToken);
        })
        .then(() => {
          userbase
            .insertItem({
              databaseName: 'public-feedback',
              item: { feedback: feedback },
            })
            .then(() => {
              feedback = '';
            })
            .catch((errorFromApi) => (error = errorFromApi));
        })
        .catch((e) => console.error(e));
    } else {
      userbase
        .insertItem({
          databaseName: 'private-feedback',
          item: { feedback: feedback },
        })
        .then(() => {
          feedback = '';
        })
        .catch((errorFromApi) => (error = errorFromApi));
    }
  }
</script>

<form on:submit={addFeedbackHandler}>
  <input type="text" required placeholder="To-Do" bind:value={feedback} />
  <input type="submit" value="Add" />
  Make public<input type="checkbox" bind:value={isPublic} />
</form>
{#if error !== ''}
  <div>{error}</div>
{/if}

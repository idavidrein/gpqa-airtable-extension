import {initializeBlock, useBase, useRecords, Button} from '@airtable/blocks/ui';
import React from 'react';
import {shuffleRecords} from './shuffle-options';
import {assignExpertValidators, assignNonExpertValidators} from './assignments.js';


function Interface() {
  let base = useBase();
  let table = base.getTable("Questions");
  let notShuffled = table.getView("Not Shuffled")
  let peopleTable = base.getTable("Experts");
  let people = useRecords(peopleTable)

  // use the useRecords hook to re-render the block whenever records are changed
  let notShuffledRecords = useRecords(notShuffled);
  let records = useRecords(table);

  const onShuffleClick = () => {
    shuffleRecords(table, notShuffledRecords)
  };

  const onExpertClick = () => {
    assignExpertValidators(table, records, people)
  };

  const onNonExpertClick = () => {
    assignNonExpertValidators(table, records, people)
  };

  return (
    <div>
      <Button onClick={onShuffleClick}>Shuffle options</Button>
      <Button onClick={onExpertClick}>Assign Expert Validators</Button>
      <Button onClick={onNonExpertClick}>Assign Non-Expert Validators</Button>
    </div>
  );
}

initializeBlock(() => < Interface />);

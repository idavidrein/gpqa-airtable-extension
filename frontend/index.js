import {initializeBlock, useBase, useRecords, Button} from '@airtable/blocks/ui';
import React from 'react';

let domainIncompatibilities = {
  "Physics": ["Engineering"],
  "Engineering": ["Physics"],
  "Math": ["Physics", "Engineering"],
  "Chemistry (general)": ["Chemical Engineering"], 
  "Chemical Engineering": ["Chemistry (general)"],
  "Computer Science": ["Machine Learning"],
  "Machine Learning": ["Computer Science"],
  "Biology": [],
  "Finance/Economics": [],
  "Medicine": [],
  "Philosophy": []
}

async function shuffleRecords(table, records) {
  let shuffled_names = ["Shuffled 1", "Shuffled 2", "Shuffled 3", "Shuffled 4", "Shuffled Correct Index"]
  let names = ["Correct Answer", "Incorrect Answer 1", "Incorrect Answer 2", "Incorrect Answer 3"]
  let revised_shuffled_names = ["Revised Shuffled 1", "Revised Shuffled 2", "Revised Shuffled 3", "Revised Shuffled 4", "Revised Shuffled Correct Index"]
  let revised_names = ["Revised Correct Answer", "Revised Incorrect Answer 1", "Revised Incorrect Answer 2", "Revised Incorrect Answer 3"]

  async function shuffle(table, records, names, shuffled_names) {
    // only shuffle records that have not been shuffled yet
    records = records.filter(record => record.getCellValueAsString(shuffled_names[0]).length === 0);
    console.log(`Shuffling ${records.length} records...`);
    let letterIndices = ["A", "B", "C", "D"]

    for (let record of records) {
      let correctValue = record.getCellValue(names[0]);
      let icValue1 = record.getCellValue(names[1]);
      let icValue2 = record.getCellValue(names[2]);
      let icValue3 = record.getCellValue(names[3]);

      // create an array of values to shuffle
      let values = [correctValue, icValue1, icValue2, icValue3];

      // shuffle the values using the Fisher-Yates shuffle algorithm
      for (let i = values.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = values[i];
        values[i] = values[j];
        values[j] = temp;
      }

      // find the index of the correct value
      let correctIndex = values.indexOf(correctValue);

      // update the record with shuffled values
      console.log(record)
      await table.updateRecordAsync(record, {
        [shuffled_names[0]]: values[0],
        [shuffled_names[1]]: values[1],
        [shuffled_names[2]]: values[2],
        [shuffled_names[3]]: values[3],
        [shuffled_names[4]]: letterIndices[correctIndex]
      });
    }
  }

  var original_records = records.filter(record => record.getCellValueAsString("Is Revised") !== "True")
  await shuffle(table, original_records, names, shuffled_names);

  var revised_records = records.filter(record => record.getCellValueAsString("Is Revised") === "True")
  await shuffle(table, revised_records, revised_names, revised_shuffled_names);
}

async function assignExpertValidators(table, records, people) {
  console.log(`Assigning expert validators to ${records.length} records...`)
  let sorted_people = people.sort((a, b) => a.getCellValue("Num Assigned Expert Val") - b.getCellValue("Num Assigned Expert Val"))
  for (let person of sorted_people) {
    console.log(person.name)
    if (person.getCellValueAsString("Active Expert Validator") !== "checked" || person.name === "NULL") {
      continue; // only assign expert validators who are active and not NULL
    }
    let assignableRecords = records.filter(record => {
        let domain = record.getCellValueAsString("Domain (from Linked Expert)");
        let isRevised = record.getCellValueAsString("Is Revised") === "True";
        return person.getCellValueAsString("Domain") === domain
        && record.getCellValueAsString("Inactive") !== "checked" // don't assign to inactive questions
        && record.getCellValueAsString("Linked Expert") !== person.name // don't assign the expert validator to their own question
        && record.getCellValueAsString("Assigned Expert Validator 1 (Uncompleted)") !== person.name
        && record.getCellValueAsString("Assigned Expert Validator 2 (Uncompleted)") !== person.name
        && ((record.getCellValue("Assigned Expert Validator 1 (Uncompleted)") === null && !isRevised)
          || (record.getCellValue("Assigned Expert Validator 2 (Uncompleted)") === null && isRevised))
        })
    console.log(assignableRecords.map(record => record.name))

    let numRecordsToAssign = 2;
    if (assignableRecords.length < numRecordsToAssign) {
      continue;
    }
    for (let i = 0; i < numRecordsToAssign; i++) {
      let record = assignableRecords[i];
      for (let j = 0; j < 2; j++) {
        // these continues mean that we can't guarantee that everyone will be assigned to 2 questions
        // at the same time
        if (j === 0 && record.getCellValue("Is Revised") === "True") {continue;}
        if (j === 1 && record.getCellValue("Is Revised") !== "True") {continue;}
        if (record.getCellValue(`Assigned Expert Validator ${j+1} (Uncompleted)`) === null) {
          await table.updateRecordAsync(record, {
            [`Assigned Expert Validator ${j+1} (Uncompleted)`]: [{id: person.id}],
            [`Assigned Expert Validator ${j+1}`]: person.name
          });
          break;
        }
      }
    }
  }
}

async function assignNonExpertValidators(table, records, people) {
  console.log(`Assigning non-expert validators to ${records.length} records...`)
  let sorted_people = people.sort((a, b) => a.getCellValue("Num Assigned Non-Expert Val") - b.getCellValue("Num Assigned Non-Expert Val"))
  console.log(sorted_people.map(person => person.name))
  for (let person of sorted_people) {
    if (person.getCellValueAsString("Active Non-Expert Validator") !== "checked" || person.name === "NULL") {
      // only assign non-expert validators who are active and not NULL
      continue;
    }
    let assignableRecords = records.filter(record => {
        let recordDomain = record.getCellValueAsString("Domain (from Linked Expert)");
        let personDomain = person.getCellValueAsString("Domain");
        return personDomain !== recordDomain
        && record.getCellValueAsString("Inactive") !== "checked" // don't assign to inactive questions
        && !domainIncompatibilities[personDomain].includes(recordDomain)
        && record.getCellValueAsString("Is Revised") === "True"
        && record.getCellValueAsString("Assigned Non-Expert Validator 1 (Uncompleted)") !== person.name
        && record.getCellValueAsString("Assigned Non-Expert Validator 2 (Uncompleted)") !== person.name
        && record.getCellValueAsString("Assigned Non-Expert Validator 3 (Uncompleted)") !== person.name
        && (record.getCellValue("Assigned Non-Expert Validator 1 (Uncompleted)") === null
          || record.getCellValue("Assigned Non-Expert Validator 2 (Uncompleted)") === null
          || record.getCellValue("Assigned Non-Expert Validator 3 (Uncompleted)") === null)
        })

    let numRecordsToAssign = 3;
    if (assignableRecords.length < numRecordsToAssign) {
      continue;
    }
    console.log(assignableRecords.map(record => record.name))
    for (let i = 0; i < numRecordsToAssign; i++) {
      for (let j = 0; j < 3; j++) {
        if (assignableRecords[i].getCellValue(`Assigned Non-Expert Validator ${j+1} (Uncompleted)`) === null) {
          await table.updateRecordAsync(assignableRecords[i], {
            [`Assigned Non-Expert Validator ${j+1} (Uncompleted)`]: [{id: person.id}],
            [`Assigned Non-Expert Validator ${j+1}`]: person.name
          });
          break;
        }
      }
    }
  }
}

function ShuffleOptions() {
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

initializeBlock(() => <ShuffleOptions />);

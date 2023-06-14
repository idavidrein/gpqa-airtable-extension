import {initializeBlock, useBase, useRecords, Button} from '@airtable/blocks/ui';
import React from 'react';

function numElements(record, field) {
  return record.getCellValue(field) === null ? 0 : record.getCellValue(field).length;
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

  for (let record of records) {

    for (let valIdx = 0; valIdx < 2; valIdx++) {

      // only assign an expert validator if there isn't already one assigned
      if (numElements(record, `Assigned Expert Validator ${valIdx+1} (Uncompleted)`) > 0) {
        continue;
      }
      // don't assign the first expert validator if the question has already been revised
      if (valIdx === 0 && record.getCellValueAsString("Is Revised") === "True") {
        continue;
      }
      // don't assign the second expert validator if the question hasn't been revised yet
      if (valIdx === 1 && record.getCellValueAsString("Is Revised") !== "True") {
        continue;
      }
      // if we're assigning the second expert validator, make sure not to assign the same expert as the first expert validator
      var firstExpertValidator;
      if (valIdx === 1) {
        if (record.getCellValue("Original Question") === null) {
          console.log('No original question linked in this record')
          continue;
        }
        let originalQuestion = record.getCellValue("Original Question")[0].id;
        console.log("Original question", record.getCellValue("Original Question")[0].name)
        let originalQuestionRecord = records.filter(record => record.id === originalQuestion)[0];
        console.log("Original question record", originalQuestionRecord)
        firstExpertValidator = originalQuestionRecord.getCellValue("Assigned Expert Validator 1");
      }
      console.log("First expert validator", firstExpertValidator)

      let domain = record.getCellValueAsString("Domain (from Linked Expert)");
      // get all people in the same domain as the question, excluding the question writer and any experts already assigned to the question
      let experts = people.filter(person => {
        if (valIdx === 1) {
          if (person.name === firstExpertValidator) {
            return false;
          }
        }
        return person.getCellValueAsString("Domain") === domain && person.name !== record.getCellValueAsString("Linked Expert")
      });
      console.log("Domain experts", domain, experts.map(person => person.name))

      // don't assign any validators if there aren't any non-experts
      if (experts.length === 0) {
        continue;
      }

      // choose the non-expert with the fewest assigned questions to be the non-expert validator, ensuring that the same non-expert is not chosen twice
      var minAssignments = 10;
      for (let i = 0; i < experts.length; i++) {
        let numAssignments = experts[i].getCellValue("Num Assigned Expert Val");
        if (numAssignments < minAssignments) {
          var expertValidator = experts[i];
          minAssignments = numAssignments;
        }
      }

      // assign the expert validator to the question
      await table.updateRecordAsync(record, {
        [`Assigned Expert Validator ${valIdx+1} (Uncompleted)`]: [{id: expertValidator.id}],
        [`Assigned Expert Validator ${valIdx+1}`]: expertValidator.name
      });
    }
  }
}

async function assignNonExpertValidators(table, records, people, expertValidationRecords) {
  console.log(`Assigning non-expert validators to ${records.length} records...`)
  console.log(`Experts: ${people.map(person => person.name)}`)
  
  for (let record of records) {
    // don't assign any non-expert validators until the question has been revised
    if (record.getCellValueAsString("Is Revised") !== "True") {
      continue;
    }
    for (let valIdx = 0; valIdx < 3; valIdx++) {
      // keep track of which non-experts have already been chosen as validators
      var chosenNonExpertValidators = [
        record.getCellValue("Assigned Non-Expert Validator 1 (Uncompleted)"),
        record.getCellValue("Assigned Non-Expert Validator 2 (Uncompleted)"),
        record.getCellValue("Assigned Non-Expert Validator 3 (Uncompleted)")
      ].filter(record => record !== null).map(record => record[0]);
      console.log("Already chosen", chosenNonExpertValidators.map(person => person.name))

      // only assign a non-expert validator if there isn't already one assigned
      if (numElements(record, `Assigned Non-Expert Validator ${valIdx+1} (Uncompleted)`) > 0) {
        continue;
      }
      let domain = record.getCellValueAsString("Domain (from Linked Expert)");
      
      // only get people who aren't assigned as the first expert validator or who have pending question revisions
      let currentlyAssignedFirstExpertVal1 = records.map(record => record.getCellValueAsString('Assigned Expert Validator 1 (Uncompleted)'))
      console.log("Currently assigned first expert val 1", currentlyAssignedFirstExpertVal1)
      let currentlyAssignedQuestionRevision = expertValidationRecords.filter(
        record => record.getCellValueAsString("To Be Revised") !== "False").map(
        record => record.getCellValueAsString("Question Writer"))
      console.log("Currently assigned question revision", currentlyAssignedQuestionRevision)

      // get all people in different domains as the question
      let nonExperts = people.filter(person => 
        person.getCellValueAsString("Domain") !== domain 
        && person.name !== "NULL"
        && !currentlyAssignedFirstExpertVal1.includes(person.name)
        && !currentlyAssignedQuestionRevision.includes(person.name));
      console.log("Domain non-experts", domain, nonExperts.map(person => person.name))

      // don't assign any validators if there aren't any non-experts
      if (nonExperts.length === 0) {
        continue;
      }

      // choose the non-expert with the fewest assigned questions to be the non-expert validator, ensuring that the same non-expert is not chosen twice
      var minAssignments = 10;
      var nonExpertValidator;
      for (let i = 0; i < nonExperts.length; i++) {
        if (chosenNonExpertValidators.some(nonExpert => nonExpert.id === nonExperts[i].id)) {
          console.log(`Already chosen num assigned non-expert val: ${nonExperts[i].getCellValue("Num Assigned Non-Expert Val")}`)
          continue;
        }
        let numAssignments = nonExperts[i].getCellValue("Num Assigned Non-Expert Val");
        console.log(`Name: ${nonExperts[i].name}, num assignments: ${numAssignments}`)
        if (numAssignments < minAssignments) {
          nonExpertValidator = nonExperts[i];
          minAssignments = numAssignments;
        }
      }

      // assign the expert validators to the question
      if (nonExpertValidator !== undefined) {
        await table.updateRecordAsync(record, {
            [`Assigned Non-Expert Validator ${valIdx+1} (Uncompleted)`]: [{id: nonExpertValidator.id}],
            [`Assigned Non-Expert Validator ${valIdx+1}`]: nonExpertValidator.name
        });
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
  let expertValidationTable = base.getTable("Expert Validations");

  // use the useRecords hook to re-render the block whenever records are changed
  let notShuffledRecords = useRecords(notShuffled);
  let records = useRecords(table);
  let expertValidationRecords = useRecords(expertValidationTable);

  const onShuffleClick = () => {
    shuffleRecords(table, notShuffledRecords)
  };

  const onExpertClick = () => {
    assignExpertValidators(table, records, people)
  };

  const onNonExpertClick = () => {
    assignNonExpertValidators(table, records, people, expertValidationRecords)
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

export async function shuffleRecords(table, records) {
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
  
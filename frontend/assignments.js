// a set of domains listed and "initialized" below indicates that each domain in a set
// is incompatible with every other domain in the set
let chemistryDomains = [
    "Biochemistry", 
    "Chemistry (general)", 
    "Chemical Engineering", 
    "Organic Chemistry"
  ]
  let physicsDomains = [
    "Physics (general)", 
    "Engineering (general)", 
    "Condensed Matter Physics", 
    "Quantum Mechanics", 
    "Electromagnetism and Photonics", 
    "High-energy particle physics", 
    "Relativistic Mechanics", 
    "Statistical Mechanics", 
    "Optics and Acoustics"
  ]
  let biologyDomains = [
    "Biology (general)",
    "Genetics",
    "Molecular Biology",
  ]
  let computerScienceDomains = [
    "Computer Science",
    "Machine Learning"
  ]
  
  var domainIncompatibilities = {}
  function initializeDomainIncompatibilities(domainSet) {
    for (let domain of domainSet) {
      domainIncompatibilities[domain] = domainSet.filter(d => d !== domain)
    }
  }
  initializeDomainIncompatibilities(chemistryDomains)
  initializeDomainIncompatibilities(physicsDomains)
  initializeDomainIncompatibilities(biologyDomains)
  initializeDomainIncompatibilities(computerScienceDomains)
  
  domainIncompatibilities["Biochemistry"].push(...["Genetics", "Molecular Biology"])
  domainIncompatibilities["Math"] = computerScienceDomains.concat(physicsDomains)

  async function assignRecordToExpert(table, record, expert, validator_idx) {
    console.assert(record.getCellValue(`Assigned Expert Validator ${validator_idx+1}`) === null)
    await table.updateRecordAsync(record, {
      [`Assigned Expert Validator ${validator_idx+1} (Uncompleted)`]: [{id: expert.id}],
      [`Assigned Expert Validator ${validator_idx+1}`]: expert.name
    });
  }  

  async function assignExpertValidators(table, records, people) {
    console.log(`Assigning expert validators to ${records.length} records...`)
    let sorted_people = people.sort((a, b) => a.getCellValue("Num Assigned Expert Val") - b.getCellValue("Num Assigned Expert Val"))
    // only assign expert validators who are active and not NULL
    sorted_people = sorted_people.filter(person => person.getCellValueAsString("Active Expert Validator") === "checked" && person.name !== "NULL")
    sorted_people = sorted_people.filter(person => person.getCellValueAsString("Num Expert Validations To Be Assigned") > 0)
    console.log(sorted_people.map(person => person.name))

    let proposals = [];
  
    for (let person of sorted_people) {
      console.log(person.name)
      let personDomains = person.getCellValue("Domain").map(domain => domain.name);
      let assignableRecords = records.filter(record => {
          let domain = record.getCellValueAsString("Question Domain");
          let isRevised = record.getCellValueAsString("Is Revised") === "True";
          return personDomains.includes(domain)
          && record.getCellValueAsString("Inactive") !== "checked" // don't assign to inactive questions
          && record.getCellValueAsString("Linked Expert") !== person.name // don't assign the expert validator to their own question
          && record.getCellValueAsString("Assigned Expert Validator 1") !== person.name
          && record.getCellValueAsString("Assigned Expert Validator 2") !== person.name
          && ((record.getCellValue("Assigned Expert Validator 1") === null && !isRevised)
            || (record.getCellValue("Assigned Expert Validator 2") === null && isRevised))
          })
      console.log(assignableRecords.map(record => record.name))
  
      let numRecordsToAssign = 1;
      if (assignableRecords.length < numRecordsToAssign) {
        console.log(`Only ${assignableRecords.length} records to assign to ${person.name}...`)
        continue;
      }
      for (let record of assignableRecords) {
        var validator_idx = 0;
        if (record.getCellValueAsString("Is Revised") === "True") {
          validator_idx = 1;
        }
        console.assert(record.getCellValue(`Assigned Expert Validator ${validator_idx+1}`) === null)
        proposals.push({record: record, expert: person, validator_idx: validator_idx});
      }
    }

    return proposals;
  }
  
  async function assignNonExpertValidators(table, records, people) {
    console.log(`Assigning non-expert validators to ${records.length} records...`)
    var sorted_people = people.sort((a, b) => a.getCellValue("Num Assigned Non-Expert Val") - b.getCellValue("Num Assigned Non-Expert Val"))
    // only assign non-expert validators who are active and not NULL
    sorted_people = sorted_people.filter(person => person.getCellValueAsString("Active Non-Expert Validator") === "checked" && person.name !== "NULL")
    sorted_people = sorted_people.filter(person => person.getCellValueAsString("Num Non-Expert Validations To Be Assigned") > 0)
    console.log(sorted_people.map(person => person.name))
  
    function checkDomainCompatibility(personDomains, recordDomain) {
      // for each domain the person is an expert in, check if they can be a non-expert validator for the record's domain
      return personDomains.every(personDomain => !domainIncompatibilities[personDomain].includes(recordDomain))
    }
  
    for (let person of sorted_people) {
      console.log(person.name)
      let personDomains = person.getCellValue("Domain").map(domain => domain.name);
      let assignableRecords = records.filter(record => {
          let recordDomain = record.getCellValueAsString("Question Domain");
          return !personDomains.includes(recordDomain)
          && record.getCellValueAsString("Inactive") !== "checked" // don't assign to inactive questions
          && checkDomainCompatibility(personDomains, recordDomain)
          && record.getCellValueAsString("Is Revised") === "True"
          && record.getCellValueAsString("Assigned Non-Expert Validator 1") !== person.name
          && record.getCellValueAsString("Assigned Non-Expert Validator 2") !== person.name
          && record.getCellValueAsString("Assigned Non-Expert Validator 3") !== person.name
          && (record.getCellValue("Assigned Non-Expert Validator 1 (Uncompleted)") === null
            || record.getCellValue("Assigned Non-Expert Validator 2 (Uncompleted)") === null
            || record.getCellValue("Assigned Non-Expert Validator 3 (Uncompleted)") === null)
          })
      console.log(assignableRecords.map(record => record.name))
  
      let numRecordsToAssign = 3;
      if (assignableRecords.length < numRecordsToAssign) {
        console.log(`Only ${assignableRecords.length} records to assign to ${person.name}...`)
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
  

  export {assignRecordToExpert, assignExpertValidators, assignNonExpertValidators}
// a set of domains listed and "initialized" below indicates that each domain in a set
// is incompatible with every other domain in the set
// The keys in domainIncompatibilities represent a person's domain, and the values are the domains
// that they cannot be a non-expert validator for
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
"Organic Chemistry"
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

async function assignRecordToExpert(table, record, person, validator_idx) {
    console.assert(record.getCellValue(`Assigned Expert Validator ${validator_idx+1}`) === null)
    await table.updateRecordAsync(record, {
        [`Assigned Expert Validator ${validator_idx+1} (Uncompleted)`]: [{id: person.id}],
        [`Assigned Expert Validator ${validator_idx+1}`]: person.name
    });
}

async function assignExpertValidators(records, people, suggestNew) {
    console.log(`Assigning expert validators to ${records.length} records...`)
    let sorted_people = people.sort((a, b) => a.getCellValue("Num Assigned Expert Val") - b.getCellValue("Num Assigned Expert Val"))
    // only assign expert validators who are active and not NULL
    sorted_people = sorted_people.filter(person => person.getCellValueAsString("Active Expert Validator") === "checked" && person.name !== "NULL")
    if (!suggestNew) {
        sorted_people = sorted_people.filter(person => person.getCellValueAsString("Num Expert Validations To Be Assigned") > 0)
    }
    console.log(sorted_people.map(person => person.name))

    let proposals = [];
    let proposedRecordIds = new Set();

    for (let person of sorted_people) {
        console.log(person.name)
        let personDomains = person.getCellValue("Domain").map(domain => domain.name);
        let numRecordsToAssign = person.getCellValue("Num Expert Validations To Be Assigned");
        let assignableRecords = records.filter(record => {
            let domain = record.getCellValueAsString("Question Domain");
            let isRevised = record.getCellValueAsString("Is Revised") === "True";
            let validator_idx = isRevised ? 1 : 0;
            let proposedKey = `${record.id}-${validator_idx}`;

            return personDomains.includes(domain)
            && record.getCellValueAsString("Inactive") !== "checked" // don't assign to inactive questions
            && record.getCellValueAsString("Question Writer") !== person.name // don't assign the expert validator to their own question
            && record.getCellValueAsString("Assigned Expert Validator 1") !== person.name
            && record.getCellValueAsString("Assigned Expert Validator 2") !== person.name
            && ((record.getCellValue("Assigned Expert Validator 1") === null && !isRevised)
            || (record.getCellValue("Assigned Expert Validator 2") === null && isRevised))
            && !proposedRecordIds.has(proposedKey)
            })
        console.log("Assignable EVs", assignableRecords.map(record => record.name))

        if (assignableRecords.length < 2) {
            console.log(`${person.name} has ${assignableRecords.length} records to assign, skipping...`)
            continue;
        }

        var numRecords = suggestNew ? assignableRecords.length : Math.min(numRecordsToAssign, assignableRecords.length);

        for (let i = 0; i < numRecords; i++) {
            var record = assignableRecords[i];
            var validator_idx = 0;
            if (record.getCellValueAsString("Is Revised") === "True") {
                validator_idx = 1;
            }
            console.assert(record.getCellValue(`Assigned Expert Validator ${validator_idx+1}`) === null)
            proposals.push({record: record, 
                person: person, 
                validator_idx: validator_idx, 
                person_domains: personDomains.join(", "), 
                question_domain: record.getCellValueAsString("Question Domain")
            });
            let proposedKey = `${record.id}-${validator_idx}`;
            proposedRecordIds.add(proposedKey);
        }
    }

    return proposals;
}

async function suggestExpertValidators(records, people) {
    var suggestions = await assignExpertValidators(records, people, true);
    // map to a list of people and the number of records they can be assigned to
    if (suggestions.length === 0) {
        return {};
    }
    var suggestionsByPerson = suggestions.reduce((suggestionsByPerson, suggestion) => {
        const accuracy = suggestion.person.getCellValueAsString("Expert Accuracy Display");
        const numAssigned = suggestion.person.getCellValue("Num Uncompleted Expert Validations");
        if (!suggestionsByPerson[suggestion.person.name]) {
            suggestionsByPerson[suggestion.person.name] = {count: 0, accuracy: accuracy, numAssigned: numAssigned};
        }
        suggestionsByPerson[suggestion.person.name].count += 1;
        return suggestionsByPerson;
    }, {});
    console.log(suggestionsByPerson)
    return suggestionsByPerson;
}

async function assignRecordToNonExpert(table, record, person, validator_idx) {
    console.assert(record.getCellValue(`Assigned Non-Expert Validator ${validator_idx+1}`) === null);
    await table.updateRecordAsync(record, {
        [`Assigned Non-Expert Validator ${validator_idx+1} (Uncompleted)`]: [{id: person.id}],
        [`Assigned Non-Expert Validator ${validator_idx+1}`]: person.name
    });
}

async function assignNonExpertValidators(records, people, suggestNew) {
    console.log(`Assigning non-expert validators to ${records.length} records...`)
    var sorted_people = people.sort((a, b) => a.getCellValue("Num Assigned Non-Expert Val") - b.getCellValue("Num Assigned Non-Expert Val"))
    // only assign non-expert validators who are active and not NULL
    sorted_people = sorted_people.filter(person => person.getCellValueAsString("Active Non-Expert Validator") === "checked" && person.name !== "NULL")
    if (!suggestNew) {
        sorted_people = sorted_people.filter(person => person.getCellValueAsString("Num Non-Expert Validations To Be Assigned") > 0)
    }
    console.log(sorted_people.map(person => person.name))
    console.log('------------------')

    function checkDomainCompatibility(personDomains, recordDomain) {
        // for each domain the person is an expert in, check if they can be a non-expert validator for the record's domain
        return personDomains.every(personDomain => !domainIncompatibilities[personDomain].includes(recordDomain))
    }

    let proposals = [];
    let proposedRecords = new Set();

    for (let person of sorted_people) {
        console.log(person.name)
        let personDomains = person.getCellValue("Domain").map(domain => domain.name);
        let numRecordsToAssign = person.getCellValue("Num Non-Expert Validations To Be Assigned");
        let assignableRecords = records.filter(record => {
            let recordDomain = record.getCellValueAsString("Question Domain");
            return !personDomains.includes(recordDomain)
            && record.getCellValueAsString("Inactive") !== "checked" // don't assign to inactive questions
            && checkDomainCompatibility(personDomains, recordDomain)
            && record.getCellValueAsString("Is Revised") === "True"
            && record.getCellValueAsString("Assigned Non-Expert Validator 1") !== person.name
            && record.getCellValueAsString("Assigned Non-Expert Validator 2") !== person.name
            && record.getCellValueAsString("Assigned Non-Expert Validator 3") !== person.name
            && ((!proposedRecords.has(record.id+"-0") && record.getCellValue("Assigned Non-Expert Validator 1") === null)
                || (!proposedRecords.has(record.id+"-1") && record.getCellValue("Assigned Non-Expert Validator 2") === null)
                || (!proposedRecords.has(record.id+"-2") && record.getCellValue("Assigned Non-Expert Validator 3") === null))
            })
        console.log(`Assigable NEVs: ${assignableRecords.map(record => record.name)}`)

        if (assignableRecords.length < 3) {
            console.log(`${person.name} has ${assignableRecords.length} records to assign, skipping...`)
            continue;
        }

        var numRecords = suggestNew ? assignableRecords.length : Math.min(numRecordsToAssign, assignableRecords.length);

        for (let i = 0; i < numRecords; i++) {
            var record = assignableRecords[i];
            for (let j = 0; j < 3; j++) {
                if (record.getCellValue(`Assigned Non-Expert Validator ${j+1}`) === null
                        && !proposedRecords.has(record.id+"-"+j)) {
                    proposals.push({
                        record: record, 
                        person: person, 
                        validator_idx: j, 
                        person_domains: personDomains.join(", "),
                        question_domain: record.getCellValueAsString("Question Domain")
                    })
                    proposedRecords.add(record.id+"-"+j);
                    console.log(`Proposed assignment of ${person.name} to ${record.name}`)
                    break;
                }
            }
        }
    }

    return proposals;
}

async function suggestNonExpertValidators(records, people) {
    var suggestions = await assignNonExpertValidators(records, people, true);
    if (suggestions.length === 0) {
        return {};
    }
    // map to a list of people and the number of records they can be assigned to
    var suggestionsByPerson = suggestions.reduce((suggestionsByPerson, suggestion) => {
        const numAssigned = suggestion.person.getCellValue("Num Uncompleted Non-Expert Validations");
        if (!suggestionsByPerson[suggestion.person.name]) {
            suggestionsByPerson[suggestion.person.name] = {count: 0, accuracy: "N/A", numAssigned: numAssigned};
        }
        suggestionsByPerson[suggestion.person.name].count += 1;
        return suggestionsByPerson;
    }, {});
    console.log('suggestionsByPerson')
    console.log(suggestionsByPerson);
    return suggestionsByPerson;
}


export {assignRecordToExpert, assignExpertValidators, assignRecordToNonExpert, assignNonExpertValidators, suggestExpertValidators, suggestNonExpertValidators}
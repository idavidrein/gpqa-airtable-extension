import {initializeBlock, useBase, useRecords, Button} from '@airtable/blocks/ui';
import React, { useState } from 'react';
import {shuffleRecords} from './shuffle-options';
import {assignRecordToExpert, assignExpertValidators, assignNonExpertValidators} from './assignments.js';


function Interface() {
  let base = useBase();
  let table = base.getTable("Questions");
  let notShuffled = table.getView("Not Shuffled")
  let peopleTable = base.getTable("Experts");
  let people = useRecords(peopleTable)

  // use the useRecords hook to re-render the block whenever records are changed
  let notShuffledRecords = useRecords(notShuffled);
  let records = useRecords(table);

  // state for holding proposed assignments
  const [proposedAssignments, setProposedAssignments] = useState([]);

  const onShuffleClick = () => {
    shuffleRecords(table, notShuffledRecords)
  };

  const onExpertClick = async () => {
    const proposals = await assignExpertValidators(records, people) 
    setProposedAssignments(proposals); // save proposals in state
  };

  const onNonExpertClick = () => {
    assignNonExpertValidators(table, records, people)
  };

  // function to handle approving an assignment
  const onApprove = async (proposal) => {
    assignRecordToExpert(table, proposal.record, proposal.expert, proposal.validator_idx)
    console.log(`Approved assignment of ${proposal.expert.name} to ${proposal.record.name}`)
    // remove the proposal from the proposedAssignments array
    setProposedAssignments(proposedAssignments.filter(p => p !== proposal));
  };

  // function to handle cancelling an assignment
  const onCancel = (proposal) => {
    // remove the proposal from the proposedAssignments array
    setProposedAssignments(proposedAssignments.filter(p => p !== proposal));
    console.log(`Cancelled assignment of ${proposal.expert.name} to ${proposal.record.name}`)
  };

  return (
    <div>
      <Button onClick={onShuffleClick}>Shuffle options</Button><br></br>
      <Button onClick={onExpertClick}>Assign Expert Validators</Button><br></br>
      <Button onClick={onNonExpertClick}>Assign Non-Expert Validators</Button><br></br>
      <br></br>

      {/* Table for displaying proposed assignments */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
        {proposedAssignments.map((proposal, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', border: '1px solid gray', borderRadius: '5px' }}>
            <div>
              <strong>Record:</strong> {proposal.record.name} <br />
              <strong>Expert:</strong> {proposal.expert.name} <br />
              <strong>Validator Index:</strong> {proposal.validator_idx+1}
            </div>
            <div>
              <Button variant="primary" onClick={() => onApprove(proposal)} style={{ marginRight: '10px' }}>Approve</Button>
              <Button variant="danger" onClick={() => onCancel(proposal)}>Cancel</Button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

initializeBlock(() => <Interface />);

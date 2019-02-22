# Calling a Component Interface from an Application Engine, part 2

[Part 1](/application_engine/ae_call_ci/) looked at the “obvious” way for an Application Engine to call a Component Interface and why that can result in fragile and abend-prone batch programs.

Instead, here’s a simple Application Class that handles most of the low-level technical details around the generally recommended approach: passing a Rowset (in this particular case, to be exact, an in-memory Record instance) to the CI instead. All you have to do is plugging in your actual business rules into `Method.ci_business_logic`.

The base classes, along with more explanations and sample code, are on my [AE2CI repository on Github](https://github.com/jpeyret/ae2ci).

I didn’t originally intend to write this up as an Application Class, but while adapting some earlier code I had written for a client, I realized that most of the repetitive and tricky code could be moved to a reusable class.


You don't have to use this class but you're welcome to take some inspiration from it.

### Design goals:

Goal|Result
------------ | -------------
Simplicity | All the tricky “technical” code stays in the base class. Business logic goes in your subclass's `ci_business_logic()` method.
Reliable error handling | Catches errors and throws exceptions automatically. Data errors (expected) and coding errors are kept separate. Display errors in message fields.
Use transactions|Commit row by row. Allow the user to correct the data for rejected rows. If multiple CIs are being called, support all-or-nothing writes.





### How to use it


#### Application Engine code to write to 2 CIs ([see github]() ):


	/* The 2 subclasses that contain your CI business logic */
	import AE2CI:*;
	import TCI:*;
	Component TCI:Wrap_CI_JOB_DATA &ci_job;
	Component TCI:Wrap_CI_PERSONAL_DATA &ci_personal;

	If (&ci_job = Null) Then
	   &ci_job = create TCI:Wrap_CI_JOB_DATA();
	End-If;

	If (&ci_personal = Null) Then
	   &ci_personal = create TCI:Wrap_CI_PERSONAL_DATA();
	End-If;

	Local boolean &saved = False;

	/* this is the state record we use to save status/error messages on */
	Local Record &rec_comm = GetRecord(Record.AE2CIAET);

	/* All you need for the Rowset are the Fill query and the Record being used */
	Local Rowset &rs_data = CreateRowset(Record.TCI_SOURCE);
	&rs_data.Fill("WHERE EMPLID = :1", TCI_AET.EMPLID);
	Local Record &rec_data = &rs_data.GetRow(1).GetRecord(Record.TCI_SOURCE);

	/* call first CI, handle exceptions */
	try
	   &saved = &ci_job.callci(&rec_comm, &rec_data);
	catch AE2CI:NoDataException &e_missing_job
	   /* we're treating missing data slightly differently, because we can differentiate based on the exception class */
	   Exit (0);
	catch Exception &e_any_job
	   SQLExec("ROLLBACK");
	   Exit (0);
	end-try;

	/* call second CI, handle exceptions */
	try
	   &saved = &ci_personal.callci(&rec_comm, &rec_data);
	catch Exception &e_ci_personal
	   SQLExec("ROLLBACK");
	   Exit (0);
	end-try;

    /* and... that's it, seen from the AE */

### `Application Class.Wrap_CI_PERSONAL_DATA` 


The other class is very similar, except for `Method.ci_business_logic`.  You could just copy/paste and change the class name.

#### First, the class declaration:

	import AE2CI:*;

	class Wrap_CI_PERSONAL_DATA extends AE2CI:CiWrapper
	   method Wrap_CI_PERSONAL_DATA();
	   method callci(&rec_comm As Record, &rec_data As Record) Returns boolean;
	   method ci_business_logic(&rec_comm As Record, &data As Record) Returns boolean;
	end-class;

	method Wrap_CI_PERSONAL_DATA
	   %Super = create AE2CI:CiWrapper(CompIntfc.CI_PERSONAL_DATA);
	end-method;

#### `Method.ci_business_logic`

	/* all of the following is strictly business-specific logic and depends on the CI,
	the data record as well as the business requirements
	*/
	method ci_business_logic
	   /+ &rec_comm as Record, +/
	   /+ &data as Record +/
	   /+ Returns Boolean +/

	   /* sample minimal update-only implementation*/
	   Local boolean &needs_saving;
	   %Super.myCI.KEYPROP_EMPLID = &data.EMPLID.Value;

	   &needs_saving = %Super.myCI.Get();
	   If Not &needs_saving Then
	      rem assign user/developer feedback to the message-holding field;
	      rem %Super.fld_message.Value = "no PERSONAL_DATA for EMPLID." | &data.EMPLID.Value;
	      /* indicate you don't need a save */
	      Return False;

	      rem or throw an Exception..., which will take care of message updating...;
	      &msg = "no data for EMPLID." | &data.EMPLID.Value;
	      throw create AE2CI:NoDataException(&msg, %This);

	   End-If;

	   &needs_saving = %This.check_business_logic_ok(&rec_comm);
	   If Not &needs_saving Then
	      Return False;
	   End-If;

	   If All(&data.BIRTHCOUNTRY.Value) Then
	      %Super.myCI.PROP_BIRTHCOUNTRY = &data.BIRTHCOUNTRY.Value;
	      &needs_saving = True;
	   End-If;

	   Return &needs_saving;

	end-method;


This method is where you map your incoming data to the CI being used. You **need** to return a boolean indicating if saving is required. Notice also that when you see some expected business problem with the data, you populate the `%Super.fld_message.Value` and return `False`. The rest of the code is much of the same and is typical of standard PeopleSoft Component Interface code.

You can also call `check_business_logic_ok()` on the base class at any time – it checks the CI’s specialized attributes/methods like `ErrorPending` on your behalf. The wrapper class will automatically call `check_business_logic_ok()` once again before attempting calling the Component Interface `save()`.

Note: I did not show method `callci` because it is always exactly the same, but needs to be re-implemented on each subclass, at least on PT 8.51, otherwise it would call the super’s `ci_business_logic`.



'use server';
/* By adding the 'use server', you mark all the exported functions within the file as server functions. 
These server functions can then be imported into Client and Server components, making them extremely versatile. */

import { z } from 'zod'; // Library that handles data type validation from the forms inputted by a user
import { sql } from '@vercel/postgres';  
import { revalidatePath } from 'next/cache'; // As we update the data in the invoices route, we want to clear this cache and trigger a new request to the server.
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// define a schema that matches the shape of your form object
const FormSchema = z.object({
    id: z.string(),
    //  Zod already throws an error if the customer field is empty as it expects a type string. 
    //  But let's add a friendly message if the user doesn't select a customer.
    customerId: z.string({
        invalid_type_error: 'Please select a customer.', 
      }),              
    // The amount field is specifically set to coerce (change) from a string to a number while also validating its type.
    // Since you are coercing the amount type from string to number, it'll default to zero if the string is empty. 
    // Let's tell Zod we always want the amount greater than 0 with the .gt() function.
    amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
    // Zod already throws an error if the status field is empty as it expects "pending" or "paid". 
    // Let's also add a friendly message if the user doesn't select a status.
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
      }),
    date: z.string(),
  });

// This is temporary until @types/react-dom is updated
export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };


  const CreateInvoice = FormSchema.omit({ id: true, date: true });    //This schema will validate the formData before saving it to a database.

export async function createInvoice(prevState: State, formData: FormData) {
// Validate form using Zod
// safeParse() will return an object containing either a success or error field. 
// This will help handle validation more gracefully without having put this logic inside the try/catch block.
    const validatedFields = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
// If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
      };
    }
   
// Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
// convert from USD to cents to avoid floating point errors
    const amountInCents = amount * 100;
// let's create a new date with the format "YYYY-MM-DD" for the invoice's creation date
    const date = new Date().toISOString().split('T')[0];
   
// Insert data into the database: create an SQL query to insert the new invoice into your database and pass in the variables
    try {
      await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;
    } catch (error) {
      // If a database error occurs, return a more specific error.
      return {
        message: 'Database Error: Failed to Create Invoice.',
      };
    }
   
    // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }

/* If you're working with forms that have many fields, instead of .get() 
you may want to consider using the entries() method with JavaScript's Object.fromEntries(). For example:
const rawFormData = Object.fromEntries(formData.entries()) */


/* The following code does: 
Extracting the data from formData.
Validating the types with Zod.
Converting the amount to cents.
Passing the variables to your SQL query.
Calling revalidatePath to clear the client cache and make a new server request.
Calling redirect to redirect the user to the invoice's page.
So once you edit an invoice, after submitting the form, you should be redirected to the invoices page, and the invoice should be updated.*/

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
// ...
 
export async function updateInvoice(
    id: string,
    prevState: State,
    formData: FormData,
  ) {
    const validatedFields = UpdateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Update Invoice.',
      };
    }
   
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
   
    try {
      await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
    } catch (error) {
      return { message: 'Database Error: Failed to Update Invoice.' };
    }
   
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }

// New action that will get called in order to delete an invoice
/* Since this action is being called in the /dashboard/invoices path, you don't need to call redirect. 
Calling revalidatePath will trigger a new server request and re-render the table. */
export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');

    // unreachable code block
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return {
            message: 'Database Error: Failed to Delete Invoice.',
          };
    }
  }

// connect the auth logic with your login form
  export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }

